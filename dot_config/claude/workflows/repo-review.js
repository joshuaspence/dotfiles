export const meta = {
  name: 'repo-review',
  description: 'Review an entire repository across many subagents, then validate the findings',
  phases: [
    { title: 'Survey' },
    { title: 'Partition' },
    { title: 'Review' },
    { title: 'Dedup' },
    { title: 'Validate' },
  ],
}

// This script is the committed orchestration for the `/repo-review` command. The command (a thin prose wrapper) parses
// arguments, runs this workflow via the Workflow tool, and formats what it returns. All I/O — GitHub permalinks (which
// need `git`) and writing `--output` — is the wrapper's job, because workflow scripts have no filesystem or git access.
// Inputs arrive on `args`: { path, effort, breadth, depth }. The return value is { findings, exclusions, gaps }.

const path = args && args.path ? String(args.path) : null
const effort = args && args.effort ? String(args.effort) : 'high'
const breadthArg = args && args.breadth != null ? args.breadth : 'auto'
const depthArg = args && args.depth != null ? args.depth : 1

const scope = path ? 'the subtree `' + path + '`' : 'the whole repository'
const lsFiles = path ? 'git ls-files -- ' + path : 'git ls-files'

// --- Effort cap for the high-fan-out (leaf) agents ---------------------------------------------------------------
// The per-unit reviewers (Review phase) and the validators (Validate phase) run at high multiplicity; launching many
// concurrent `max` Opus inferences has been observed to intermittently stall, and the Review phase is a barrier, so a
// single hung agent can wedge the run. Cap those leaf agents at `xhigh` (clamp only `max` down). The few surveyors,
// the partitioner, the dedup agent, and the three architecture lenses keep the requested effort.
const EFFORT_ORDER = ['low', 'medium', 'high', 'xhigh', 'max']
function capLeaf(e) {
  const i = EFFORT_ORDER.indexOf(e)
  const cap = EFFORT_ORDER.indexOf('xhigh')
  return i > cap ? 'xhigh' : e
}
const leafEffort = capLeaf(effort)

// --- Schemas -----------------------------------------------------------------------------------------------------
const ISSUE = {
  type: 'object',
  properties: {
    description: { type: 'string', description: 'What the issue is' },
    severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
    category: { type: 'string', description: 'One of: claude-md, bug, security, consistency, code-quality, test-critique, architecture' },
    file: { type: 'string', description: 'Primary repo-relative file path; for repo-wide findings, the most relevant module or file' },
    lines: { type: 'string', description: 'Line or range, e.g. "10" or "10-15"; empty when not line-specific' },
    otherSites: { type: 'array', items: { type: 'string' }, description: 'Other affected sites (file:line or module), if any' },
    reason: { type: 'string', description: 'Why it was flagged (e.g. "bug", "CLAUDE.md adherence", "architecture")' },
  },
  required: ['description', 'severity', 'file', 'reason'],
}
const ISSUES_SCHEMA = { type: 'object', properties: { issues: { type: 'array', items: ISSUE } }, required: ['issues'] }

const SURVEY_SCHEMA = {
  type: 'object',
  properties: {
    languages: { type: 'array', items: { type: 'string' } },
    tooling: { type: 'string', description: 'Build and test tooling' },
    entryPoints: { type: 'array', items: { type: 'string' } },
    structure: { type: 'string', description: 'Top-level directory structure with a file count per directory' },
  },
  required: ['languages', 'tooling', 'entryPoints', 'structure'],
}

const CLAUDEMD_SCHEMA = { type: 'object', properties: { paths: { type: 'array', items: { type: 'string' } } }, required: ['paths'] }

const PARTITION_SCHEMA = {
  type: 'object',
  properties: {
    units: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          paths: { type: 'array', items: { type: 'string' } },
          summary: { type: 'string' },
        },
        required: ['name', 'paths'],
      },
    },
    exclusions: {
      type: 'array',
      items: {
        type: 'object',
        properties: { path: { type: 'string' }, reason: { type: 'string' } },
        required: ['path', 'reason'],
      },
    },
  },
  required: ['units', 'exclusions'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: { confirmed: { type: 'boolean' }, rationale: { type: 'string' } },
  required: ['confirmed', 'rationale'],
}

// --- Shared prompt fragments -------------------------------------------------------------------------------------
function surveyBlock(survey) {
  return 'Repository survey (for context on the repo\'s purpose and conventions):\n' + JSON.stringify(survey, null, 2)
}

const SEVERITY_RUBRIC =
  'Severity reflects the impact if the issue is left unfixed: "critical" (security hole, data loss, or a defect that ' +
  'breaks core behaviour), "high" (wrong behaviour on a common path, or a serious maintainability trap), "medium" (a ' +
  'real defect with limited blast radius), "low" (a minor quality issue).'

const REVIEW_RULES =
  'Do not build, typecheck, lint, or test the repository — review the source as written. You may consult authoritative ' +
  'upstream documentation to confirm how an external API, library, or framework behaves, but every finding must cite a ' +
  'location in this repository. Prefer `git ls-files` over `find`. If you are not certain an issue is real, do not flag ' +
  'it — false positives erode trust. Cite each issue with a file path and, where applicable, a line or range.'

const FALSE_POSITIVES =
  'Do NOT flag these (they are false positives): something that looks like a bug but is actually correct; pedantic ' +
  'nitpicks a senior engineer would not raise; issues a linter would catch; issues named in CLAUDE.md but explicitly ' +
  'silenced in the code (e.g. a lint-ignore comment); and deliberate, documented deviations where a comment explains ' +
  'why. Note: "pre-existing" is NOT a reason to dismiss — every issue in a repository review is pre-existing. Judge ' +
  'each issue on whether it is real and significant today.'

// --- Per-unit reviewers (Agents 1-6) -----------------------------------------------------------------------------
const REVIEWERS = [
  {
    key: 'claude-md',
    model: 'sonnet',
    title: 'CLAUDE.md compliance',
    instruction:
      'Audit the unit for CLAUDE.md compliance against the governing CLAUDE.md files listed below. You are given ' +
      'their paths, not their text — read their contents before judging. When evaluating compliance for a file, ' +
      'consider only CLAUDE.md files that share a path with that file or its ancestor directories.',
  },
  {
    key: 'bug',
    model: 'opus',
    title: 'Bug',
    instruction:
      'Scan for correctness bugs within the unit: incorrect logic, unhandled error paths, broken invariants, ' +
      'resource leaks, concurrency mistakes.',
  },
  {
    key: 'security',
    model: 'opus',
    title: 'Security',
    instruction:
      'Look for security problems in the unit: injection, unsafe deserialization, path traversal, missing ' +
      'authorization checks, secrets committed to the repository. Where a dependency or known-vulnerable pattern is ' +
      'involved, cross-check against upstream security advisories before flagging.',
  },
  {
    key: 'consistency',
    model: 'sonnet',
    title: 'Consistency',
    instruction:
      'Look for problems only visible with the whole repository in view: callers that disagree with a function\'s ' +
      'current contract, duplicated logic that has diverged, dead code that is still exported, and configuration that ' +
      'contradicts the code that reads it. Cross-reference against the other units, not just this one.',
  },
  {
    key: 'code-quality',
    model: 'sonnet',
    title: 'Code quality',
    instruction:
      'Flag maintainability problems within the unit that a senior engineer would call out in review: hand-written ' +
      'code that reimplements what a mature, widely-used package already provides (name the package, and only where ' +
      'adopting it is a clear win — not trivial one-liners); verbose, redundant, or stale comments and commented-out ' +
      'code; needless complexity where a simpler idiomatic construct would do; and gaps in test coverage (non-trivial ' +
      'logic, branches, or error paths no test exercises) in a unit that otherwise ships tests — name the specific ' +
      'behaviour. Do not flag missing tests for trivial glue code, a unit/repo with no test suite at all, stylistic ' +
      'preferences a linter/formatter handles, or dependencies where the hand-written code is small and self-contained.',
  },
  {
    key: 'test-critique',
    model: 'sonnet',
    title: 'Test critique',
    instruction:
      'Critique the quality of the tests that already exist in the unit — whether they would actually catch a ' +
      'regression (distinct from coverage gaps). Flag: vacuous or weak assertions (would still pass if the code were ' +
      'broken; asserting only that a call did not throw; asserting a mocked return value; meaningless snapshots); ' +
      'tests coupled to implementation details rather than observable behaviour; over-mocking so the test exercises ' +
      'the doubles, not the real path; non-determinism (wall-clock, sleep, network, order/state leakage); and tests ' +
      'whose name contradicts what they assert. Do not flag the mere absence of tests, a unit/repo that ships none, ' +
      'or stylistic test preferences a linter/formatter handles.',
  },
]

// --- Architecture lenses (Agent 7) — one instance each, over the whole repo, blind to the others -----------------
const ARCH_LENSES = [
  {
    key: 'dependency-structure',
    instruction:
      'Dependency structure — circular dependencies between packages, import direction that violates the intended ' +
      'flow, and coupling hotspots where one module is entangled with many others.',
  },
  {
    key: 'layering-and-boundaries',
    instruction:
      'Layering and boundaries — modules reaching across architectural layers or package boundaries they should not, ' +
      'and internal details that leak across those boundaries.',
  },
  {
    key: 'cohesion-and-duplication',
    instruction:
      'Cohesion and duplication — subsystems with overlapping or duplicated responsibilities, and organization that ' +
      'contradicts the conventions in the survey or the repository-root CLAUDE.md.',
  },
]

function surveyPrompt() {
  return (
    'Survey ' + scope + ' to orient a whole-repository code review. Use `' + lsFiles + '` to enumerate files (do not ' +
    'walk the filesystem, so ignored files stay out). Return: the primary programming languages; the build and test ' +
    'tooling; the entry points; and the top-level directory structure with a file count per directory.'
  )
}

function claudemdPrompt() {
  return (
    'List the repo-relative paths of every CLAUDE.md file in the repository (enumerate with `git ls-files`). Return ' +
    'only the paths — not their contents.'
  )
}

function partitionPrompt(survey) {
  const target =
    breadthArg === 'auto' || breadthArg == null
      ? 'Choose the number of units that best fits the repository, in the range 4-8.'
      : 'Partition into exactly ' + parseInt(breadthArg, 10) + ' units.'
  return (
    'Partition ' + scope + ' into coherent review units, using the survey below. ' + target + ' Each unit should be a ' +
    'module, package, or directory group that can be understood on its own; give it a short name and the list of ' +
    'repo-relative paths it covers (enumerate with `' + lsFiles + '`). Also return an explicit list of everything you ' +
    'excluded and why — exclude vendored/third-party dependencies, generated code, lock files, and binary files.\n\n' +
    surveyBlock(survey)
  )
}

function reviewerPrompt(r, unit, survey, claudemdPaths) {
  let extra = ''
  if (r.key === 'claude-md') {
    const list = claudemdPaths.length ? claudemdPaths.map(function (p) { return '- ' + p }).join('\n') : '(none found)'
    extra = '\n\nGoverning CLAUDE.md files (paths only — read their contents yourself):\n' + list
  }
  const files = (unit.paths || []).map(function (p) { return '- ' + p }).join('\n')
  return (
    'You are the ' + r.title + ' reviewer. ' + r.instruction + '\n\n' +
    'Review this unit: "' + unit.name + '".\nFiles in scope:\n' + files + '\n\n' +
    SEVERITY_RUBRIC + '\n\n' +
    'Return a list of issues. For each: a description, a severity, the category "' + r.key + '", the primary file and ' +
    'line/range (or the set of files/modules for repo-wide findings), and the reason it was flagged. ' + REVIEW_RULES +
    '\n\n' + FALSE_POSITIVES + extra + '\n\n' + surveyBlock(survey)
  )
}

function archPrompt(lens, survey, claudemdPaths) {
  let extra = ''
  if (lens.key === 'cohesion-and-duplication') {
    const root = claudemdPaths.filter(function (p) { return p === 'CLAUDE.md' })[0]
    if (root) extra = '\n\nRepository-root CLAUDE.md: ' + root + ' — read it yourself and judge organization against it.'
  }
  const scopeNote = path
    ? ' A path scope is in effect (`' + path + '`): examine the whole repository but report only defects that involve ' +
      'that subtree.'
    : ''
  return (
    'You are the Architecture reviewer, restricted to a single lens and blind to the others. Assess the repository\'s ' +
    'overall structure and design coherence, not individual files.\n\nLens — ' + lens.instruction + scopeNote + '\n\n' +
    SEVERITY_RUBRIC + '\n\n' +
    'Flag only concrete, demonstrable structural defects, and cite the specific modules or files involved. Do not flag ' +
    'subjective preferences or "this would be cleaner as X" rewrites. Return issues with category "architecture". ' +
    REVIEW_RULES + extra + '\n\n' + surveyBlock(survey)
  )
}

function dedupPrompt(issues) {
  return (
    'Deduplicate the following review findings before validation. Merge only genuine duplicates — findings that share ' +
    'a root cause, or the same file, line, and category — into one issue with a primary location and a list of the ' +
    'other affected sites (`otherSites`), giving the merged issue the highest severity among those merged. When in ' +
    'doubt, keep findings separate. Preserve each issue\'s description, severity, category, file, lines, and reason.\n\n' +
    'Findings (' + issues.length + '):\n' + JSON.stringify(issues, null, 2)
  )
}

function validatorPrompt(issue, survey) {
  return (
    'Independently validate whether the following reported issue is real, with high confidence. Open the actual ' +
    'file(s) yourself — or, for repository-wide findings, the relevant files and structure — rather than trusting the ' +
    'report\'s excerpt. Confirm the specific claim: e.g. if "variable is not defined" was flagged, verify that is ' +
    'actually true in the code; for a CLAUDE.md issue, confirm the cited rule is scoped for the file and is actually ' +
    'violated. Confirm only if the issue is truly an issue and significant today ("pre-existing" is not grounds to ' +
    'dismiss it). Return { confirmed, rationale }.\n\nIssue:\n' + JSON.stringify(issue, null, 2) + '\n\n' + surveyBlock(survey)
  )
}

// --- Orchestration ------------------------------------------------------------------------------------------------
const gaps = []

// Phases 1 & 2 — Survey and CLAUDE.md scan, concurrently (both `haiku`, full requested effort).
phase('Survey')
const surveyResults = await parallel([
  function () { return agent(surveyPrompt(), { label: 'survey', phase: 'Survey', model: 'haiku', effort: effort, schema: SURVEY_SCHEMA }) },
  function () { return agent(claudemdPrompt(), { label: 'claude-md-scan', phase: 'Survey', model: 'haiku', effort: effort, schema: CLAUDEMD_SCHEMA }) },
])
const survey = surveyResults[0]
const claudemd = surveyResults[1]
if (!survey) {
  return { findings: [], exclusions: [], gaps: ['Survey agent did not return — review aborted (no repository context to work from).'] }
}
const claudemdPaths = claudemd && claudemd.paths ? claudemd.paths : []
if (!claudemd) gaps.push('CLAUDE.md scan did not return — compliance reviewers ran without a governing-file list.')

// Phase 3 — Partition (`sonnet`, full requested effort).
phase('Partition')
const partition = await agent(partitionPrompt(survey), { label: 'partition', phase: 'Partition', model: 'sonnet', effort: effort, schema: PARTITION_SCHEMA })
if (!partition || !partition.units || partition.units.length === 0) {
  return { findings: [], exclusions: partition && partition.exclusions ? partition.exclusions : [], gaps: ['Partition agent did not return usable units — review aborted.'] }
}
const units = partition.units
const exclusions = partition.exclusions || []
log('Partitioned into ' + units.length + ' unit(s); ' + exclusions.length + ' exclusion(s).')

// Phase 4 — Review (barrier). Per unit: Agents 1-6 at capped leaf effort. Whole repo: 3 architecture lenses at full
// effort. This must complete before dedup, which reasons over every finding, so it runs as a single parallel() barrier.
phase('Review')
const reviewSpecs = []
for (let u = 0; u < units.length; u++) {
  const unit = units[u]
  for (let ri = 0; ri < REVIEWERS.length; ri++) {
    const r = REVIEWERS[ri]
    reviewSpecs.push({
      label: 'review:' + unit.name + ':' + r.key,
      model: r.model,
      effort: leafEffort,
      category: r.key,
      prompt: reviewerPrompt(r, unit, survey, claudemdPaths),
    })
  }
}
for (let li = 0; li < ARCH_LENSES.length; li++) {
  const lens = ARCH_LENSES[li]
  reviewSpecs.push({
    label: 'review:arch:' + lens.key,
    model: 'opus',
    effort: effort,
    category: 'architecture',
    prompt: archPrompt(lens, survey, claudemdPaths),
  })
}
const reviewResults = await parallel(
  reviewSpecs.map(function (s) {
    return function () {
      return agent(s.prompt, { label: s.label, phase: 'Review', model: s.model, effort: s.effort, schema: ISSUES_SCHEMA })
    }
  })
)
const rawIssues = []
for (let i = 0; i < reviewResults.length; i++) {
  const res = reviewResults[i]
  const spec = reviewSpecs[i]
  if (!res || !res.issues) {
    gaps.push('Reviewer did not complete: ' + spec.label)
    continue
  }
  for (let j = 0; j < res.issues.length; j++) {
    const issue = res.issues[j]
    issue.category = spec.category // authoritative — do not depend on the model to label it
    rawIssues.push(issue)
  }
}
log('Review produced ' + rawIssues.length + ' raw finding(s) across ' + reviewSpecs.length + ' reviewer(s).')

// Phase 5 — Dedup (`opus`, one agent). A deterministic script cannot reason over findings, so this is delegated.
phase('Dedup')
let deduped = rawIssues
if (rawIssues.length > 0) {
  const dd = await agent(dedupPrompt(rawIssues), { label: 'dedup', phase: 'Dedup', model: 'opus', effort: effort, schema: ISSUES_SCHEMA })
  if (dd && dd.issues) {
    deduped = dd.issues
    log('Deduplicated ' + rawIssues.length + ' -> ' + deduped.length + ' finding(s).')
  } else {
    gaps.push('Dedup agent did not return — validating the raw, un-deduplicated findings instead.')
  }
}

// Phase 6 — Validate (barrier). Per issue, run --depth independent validators; keep on a strict majority of those that
// return. High-risk categories validate on `opus`, the rest on `sonnet`; both at capped leaf effort.
phase('Validate')
const HIGH_RISK = ['bug', 'security', 'consistency', 'architecture']
function isHighRisk(issue) {
  return HIGH_RISK.indexOf(issue.category) !== -1
}
function validatorCount(issue) {
  if (depthArg === 'auto') return isHighRisk(issue) ? 3 : 1
  const n = parseInt(depthArg, 10)
  return isNaN(n) || n < 1 ? 1 : n
}
const verdicts = await parallel(
  deduped.map(function (issue, idx) {
    return async function () {
      const count = validatorCount(issue)
      const model = isHighRisk(issue) ? 'opus' : 'sonnet'
      const votes = await parallel(
        Array.from({ length: count }, function (_, k) {
          return function () {
            return agent(validatorPrompt(issue, survey), {
              label: 'validate:' + issue.category + ':' + idx + ':' + k,
              phase: 'Validate',
              model: model,
              effort: leafEffort,
              schema: VERDICT_SCHEMA,
            })
          }
        })
      )
      const returned = votes.filter(Boolean)
      if (returned.length === 0) {
        gaps.push('Validation did not complete for a ' + issue.category + ' finding: ' + issue.description.slice(0, 80))
        return null
      }
      const yes = returned.filter(function (v) { return v.confirmed }).length
      // Strict majority of the validators that actually returned (>, not >=, so 1-of-2 is dropped).
      return yes > returned.length / 2 ? issue : null
    }
  })
)
const findings = verdicts.filter(Boolean)

log('Validated ' + findings.length + ' finding(s); ' + gaps.length + ' gap(s).')
return { findings: findings, exclusions: exclusions, gaps: gaps }
