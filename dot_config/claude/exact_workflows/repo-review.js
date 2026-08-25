/**
 * This script is the committed orchestration for the `/repo-review` command. The command (a thin prose wrapper) parses
 * arguments, runs this workflow via the `Workflow` tool, and formats what it returns. All I/O — GitHub permalinks
 * (which need `git`) and writing `--output` — is the wrapper's job, because workflow scripts have no filesystem or git
 * access.
 *
 * Inputs arrive on `args`: `{ path, effort, breadth, depth, loop }`. The return value is
 * `{ findings, exclusions, gaps }`.
 */

export const meta = {
  name: 'repo-review',
  description: 'Review an entire repository across many subagents, then validate the findings',
  whenToUse: 'When a review of the entire repository is requested',
  phases: [
    { title: 'Survey' },
    { title: 'Partition' },
    { title: 'Review' },
    { title: 'Dedupe' },
    { title: 'Validate' },
  ],
};

const path = args?.path;
const scope = path ? `the subtree \`${path}\`` : 'the whole repository';
const lsFiles = path ? `git ls-files -- ${path}` : 'git ls-files';


// --- Configuration knobs ------------------------------------------------------------------------------------------
// Each knob tolerates missing or malformed input. `effort` gates every agent (clamped to a known level). `breadth`
// (partition-unit count) and `depth` (validators per finding) accept the sentinel 'auto' or a positive integer.
const EFFORT_ORDER = ['low', 'medium', 'high', 'xhigh', 'max'];
const effort = EFFORT_ORDER.includes(args?.effort) ? args.effort : 'high';

function positiveIntOr(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isNaN(n) || n < 1 ? fallback : n;
}

const breadth = args?.breadth === 'auto' ? 'auto' : positiveIntOr(args?.breadth, 'auto');
const depth = args?.depth === 'auto' ? 'auto' : positiveIntOr(args?.depth, 1);

// `--loop` turns on multi-round "loop-until-dry" reviewing. The wrapper sends `loop: true` for a bare `--loop` and an
// integer for `--loop <n>`; anything absent means a single pass. `maxRounds` caps how many times the Review+Dedupe body
// repeats; the loop stops earlier the first time a round adds no new findings.
const LOOP_DEFAULT_ROUNDS = 4;
const loopEnabled = (args?.loop ?? false) !== false;
const maxRounds = loopEnabled ? positiveIntOr(args?.loop, LOOP_DEFAULT_ROUNDS) : 1;


// --- Effort cap for the high-fan-out (leaf) agents ---------------------------------------------------------------
// The per-unit reviewers (Review phase) and the validators (Validate phase) run at high multiplicity; launching many
// concurrent `max` Opus inferences has been observed to intermittently stall, and the Review phase is a barrier, so a
// single hung agent can wedge the run. Cap those leaf agents at `xhigh` (clamp only `max` down). The few surveyors,
// the partitioner, the dedup agent, and the three architecture lenses keep the requested effort.
const capLeaf = (e) =>
  EFFORT_ORDER.indexOf(e) > EFFORT_ORDER.indexOf('xhigh') ? 'xhigh' : e;
const leafEffort = capLeaf(effort);


// --- Schemas -----------------------------------------------------------------------------------------------------
const STRING_ARRAY = { type: 'array', items: { type: 'string' } };

const ISSUE = {
  type: 'object',
  properties: {
    description: {
      type: 'string',
      description: 'What the issue is',
    },
    severity: {
      type: 'string',
      enum: ['critical', 'high', 'medium', 'low'],
    },
    category: {
      type: 'string',
      enum: ['architecture', 'bug', 'claude-md', 'code-quality', 'consistency', 'security', 'test-critique'],
    },
    file: {
      type: 'string',
      description: 'Primary repo-relative file path; for repo-wide findings, the most relevant module or file',
    },
    lines: {
      type: 'string',
      description: 'Line or range, e.g. "10" or "10-15"; empty when not line-specific',
    },
    otherSites: {
      ...STRING_ARRAY,
      description: 'Other affected sites (file:line or module), if any',
    },
    reason: {
      type: 'string',
      description: 'Why it was flagged (e.g. "bug", "CLAUDE.md adherence", "architecture")',
    },
  },
  required: ['description', 'severity', 'category', 'file', 'reason'],
};

const ISSUES_SCHEMA = {
  type: 'object',
  properties: {
    issues: { type: 'array', items: ISSUE },
  },
  required: ['issues'],
};

const SURVEY_SCHEMA = {
  type: 'object',
  properties: {
    languages: STRING_ARRAY,
    tooling: {
      type: 'string',
      description: 'Build and test tooling',
    },
    entryPoints: STRING_ARRAY,
    structure: {
      type: 'array',
      description: 'Top-level directory structure, one entry per directory',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          fileCount: { type: 'integer' },
        },
        required: ['path', 'fileCount'],
      },
    },
  },
  required: ['languages', 'tooling', 'entryPoints', 'structure'],
};

const CLAUDE_MD_SCHEMA = {
  type: 'object',
  properties: { paths: STRING_ARRAY },
  required: ['paths'],
};

const PARTITION_SCHEMA = {
  type: 'object',
  properties: {
    units: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          summary: { type: 'string' },
          paths: STRING_ARRAY,
        },
        required: ['name', 'paths'],
      },
    },
    exclusions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['path', 'reason'],
      },
    },
  },
  required: ['units', 'exclusions'],
};

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    confirmed: { type: 'boolean' },
    rationale: { type: 'string' },
  },
  required: ['confirmed', 'rationale'],
};


// --- Shared prompt fragments -------------------------------------------------------------------------------------
// Render a list of paths/sites as markdown bullets, falling back to `empty` when there is nothing to list.
const bulletList = (items, empty) => items?.length ? items.map((p) => `- ${p}`).join('\n') : empty;
const surveyBlock = (survey) =>
  `Repository survey (for context on the repo's purpose and conventions):\n${JSON.stringify(survey, null, 2)}`;

const FALSE_POSITIVES =
  'Do NOT flag these (they are false positives): something that looks like a bug but is actually correct; pedantic ' +
  'nitpicks a senior engineer would not raise; issues a linter would catch; issues named in `CLAUDE.md` but explicitly ' +
  'silenced in the code (e.g. a lint-ignore comment); and deliberate, documented deviations where a comment explains ' +
  'why. Note: "pre-existing" is NOT a reason to dismiss — every issue in a repository review is pre-existing. Judge ' +
  'each issue on whether it is real and significant today.';

const REVIEW_RULES =
  'Do not build, typecheck, lint, or test the repository — review the source as written. You may consult authoritative ' +
  'upstream documentation to confirm how an external API, library, or framework behaves, but every finding must cite a ' +
  'location in this repository. Prefer `git ls-files` over `find`. If you are not certain an issue is real, do not flag ' +
  'it — false positives erode trust. Cite each issue with a file path and, where applicable, a line or range.';

const SEVERITY_RUBRIC =
  'Severity reflects the impact if the issue is left unfixed: "critical" (security hole, data loss, or a defect that ' +
  'breaks core behaviour), "high" (wrong behaviour on a common path, or a serious maintainability trap), "medium" (a ' +
  'real defect with limited blast radius), "low" (a minor quality issue).';


// --- Loop-until-dry fragments ------------------------------------------------------------------------------------
// With `--loop`, the Review+Dedupe body repeats. Round 1 is the baseline pass — it gets no emphasis and an empty
// feedback list, so its prompts are byte-identical to a single-pass run. Rounds 2+ are steered toward what earlier
// passes missed by two additions: an escalating emphasis directive, and a scoped list of already-reported findings.
// `ROUND_EMPHASIS` is indexed by 1-based round; rounds past the last entry reuse the deepest directive.
const ROUND_EMPHASIS = [
  '', // index 0 — unused (rounds are 1-based)
  '', // round 1 — baseline pass, no emphasis
  'This is a follow-up pass over code earlier passes already reviewed. Deliberately look past the issues they would ' +
    'have caught: less-travelled branches, edge cases, and interactions a first read skims over.',
  'This is a deeper follow-up pass. Concentrate on subtle, cross-cutting, or rare-condition defects that surface only ' +
    'under specific inputs, orderings, or configurations — the kind a careful second reader finds after the easy wins.',
  'This is a final deep pass. Assume the easy and moderate issues are already reported; hunt only for the most ' +
    'subtle, well-hidden, or emergent problems that survive repeated reads.',
];
const roundEmphasis = (round) => ROUND_EMPHASIS[Math.min(round ?? 1, ROUND_EMPHASIS.length - 1)];
const emphasisBlock = (round) => {
  const text = roundEmphasis(round);
  return text ? `\n\n${text}` : '';
};

// Render the "already reported, look elsewhere" feedback list; empty when there is nothing accumulated yet.
const knownFindingsBlock = (known) =>
  known?.length
    ? '\n\nAlready reported by earlier passes — do NOT re-report these; find what they missed:\n' +
      known.map((f) => `- [${f.category}] ${f.file}${f.lines ? `:${f.lines}` : ''} — ${f.description}`).join('\n')
    : '';

// A finding belongs to a unit when its primary file is one of the unit's paths or sits beneath one of them.
const fileInUnit = (file, unit) =>
  !!file && (unit.paths || []).some((p) => file === p || file.startsWith(p.endsWith('/') ? p : `${p}/`));


// --- Per-unit reviewers (Agents 1-6) -----------------------------------------------------------------------------
const REVIEWERS = [
  {
    key: 'bug',
    model: 'opus',
    title: 'Bug',
    instruction:
      'Scan for correctness bugs within the unit: incorrect logic, unhandled error paths, broken invariants, ' +
      'resource leaks, concurrency mistakes.',
  },
  {
    key: 'claude-md',
    model: 'sonnet',
    title: 'CLAUDE.md compliance',
    instruction:
      'Audit the unit for `CLAUDE.md` compliance against the governing `CLAUDE.md` files listed below. You are ' +
      'given their paths, not their text — read their contents before judging. When evaluating compliance for a ' +
      'file, consider only `CLAUDE.md` files that share a path with that file or its ancestor directories.',
  },
  {
    key: 'code-quality',
    model: 'sonnet',
    title: 'Code quality',
    instruction:
      'Flag maintainability problems within the unit that a senior engineer would call out in review: hand-written ' +
      'code that reimplements what a mature, widely-used package already provides (name the package, and only where ' +
      'adopting it is a clear win — not trivial one-liners); verbose, redundant, or stale comments and commented-out ' +
      'code; and needless complexity where a simpler idiomatic construct would do. Do not flag stylistic preferences ' +
      'a linter/formatter handles, or dependencies where the hand-written code is small and self-contained.',
  },
  {
    key: 'consistency',
    model: 'sonnet',
    title: 'Consistency',
    instruction:
      "Look for problems only visible with the whole repository in view: callers that disagree with a function's " +
      'current contract, duplicated logic that has diverged, dead code that is still exported, and configuration that ' +
      'contradicts the code that reads it. Cross-reference against the other units, not just this one.',
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
    key: 'test-critique',
    model: 'sonnet',
    title: 'Test critique',
    instruction:
      'Critique the tests in the unit on two axes. Coverage — non-trivial logic, branches, or error paths that no ' +
      'test exercises, in a unit that otherwise ships tests; name the specific untested behaviour. Quality — whether ' +
      'the tests that exist would actually catch a regression: vacuous or weak assertions (would still pass if the ' +
      'code were broken; asserting only that a call did not throw; asserting a mocked return value; meaningless ' +
      'snapshots); tests coupled to implementation details rather than observable behaviour; over-mocking so the ' +
      'test exercises the doubles, not the real path; non-determinism (wall-clock, sleep, network, order/state ' +
      'leakage); and tests whose name contradicts what they assert. Do not flag missing tests for trivial glue code, ' +
      'a unit/repo that ships no tests at all, or stylistic test preferences a linter/formatter handles.',
  },
];


// --- Architecture lenses (Agent 7) — one instance each, over the whole repo, blind to the others -----------------
const ARCHITECTURAL_LENSES = [
  {
    key: 'cohesion-and-duplication',
    instruction:
      'Cohesion and duplication — subsystems with overlapping or duplicated responsibilities, and organization that ' +
      'contradicts the conventions in the survey or the repository-root CLAUDE.md.',
  },
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
];

const claudeMdPrompt = () =>
  'List the repo-relative paths of every `CLAUDE.md` file in the repository (enumerate with `git ls-files`). Return ' +
  'only the paths — not their contents.';

const dedupePrompt = (issues) =>
  'Deduplicate the following review findings before validation. Merge only genuine duplicates — findings that share ' +
  'a root cause, or the same file, line, and category — into one issue with a primary location and a list of the ' +
  'other affected sites (`otherSites`), giving the merged issue the highest severity among those merged. When in ' +
  "doubt, keep findings separate. Preserve each issue's description, severity, category, file, lines, and reason.\n\n" +
  `Findings (${issues.length}):\n${JSON.stringify(issues, null, 2)}`;

const surveyPrompt = () =>
  `Survey ${scope} to orient a whole-repository code review. Use \`${lsFiles}\` to enumerate files (do not walk the ` +
  'filesystem, so ignored files stay out). Return: the primary programming languages; the build and test tooling; ' +
  'the entry points; and the top-level directory structure with a file count per directory.';

const validatorPrompt = (issue, survey) =>
  'Independently validate whether the following reported issue is real, with high confidence. Open the actual ' +
  'file(s) yourself — or, for repository-wide findings, the relevant files and structure — rather than trusting the ' +
  'report\'s excerpt. Confirm the specific claim: e.g. if "variable is not defined" was flagged, verify that is ' +
  'actually true in the code; for a `CLAUDE.md` issue, confirm the cited rule is scoped for the file and is actually ' +
  'violated. Confirm only if the issue is truly an issue and significant today ("pre-existing" is not grounds to ' +
  `dismiss it). Return \`{ confirmed, rationale }\`.\n\n` +
  `Issue:\n${JSON.stringify(issue, null, 2)}\n\n${surveyBlock(survey)}`;

function architecturalLensPrompt(lens, survey, claudeMdPaths, roundCtx = {}) {
  let extra = '';

  if (lens.key === 'cohesion-and-duplication') {
    const root = claudeMdPaths.find((p) => p === 'CLAUDE.md');

    if (root) {
      extra = `\n\nRepository-root \`CLAUDE.md\`: ${root} — read it yourself and judge organization against it.`;
    }
  }

  const scopeNote = path
    ? ` A path scope is in effect (\`${path}\`): examine the whole repository but report only defects that involve that subtree.`
    : '';

  return (
    "You are the Architecture reviewer, restricted to a single lens and blind to the others. " +
    "Assess the repository's overall structure and design coherence, not individual files.\n\n" +
    `Lens — ${lens.instruction}${scopeNote}\n\n` +
    `${SEVERITY_RUBRIC}\n\n` +
    'Flag only concrete, demonstrable structural defects, and cite the specific modules or files involved. Do not flag ' +
    'subjective preferences or "this would be cleaner as X" rewrites. Return issues with category "architecture". ' +
    `${REVIEW_RULES}${extra}${emphasisBlock(roundCtx.round)}${knownFindingsBlock(roundCtx.known)}\n\n${surveyBlock(survey)}`
  );
}

function partitionPrompt(survey) {
  const target =
    breadth === 'auto'
      ? 'Choose the number of units that best fits the repository, in the range 4-8.'
      : `Partition into exactly ${breadth} units.`;

  return (
    `Partition ${scope} into coherent review units, using the survey below. ${target} Each unit should be a module, ` +
    'package, or directory group that can be understood on its own; give it a short name and the list of ' +
    `repo-relative paths it covers (enumerate with \`${lsFiles}\`). Also return an explicit list of everything you ` +
    'excluded and why — exclude vendored/third-party dependencies, generated code, lock files, and binary files.\n\n' +
    surveyBlock(survey)
  );
}

function reviewerPrompt(reviewer, unit, survey, claudeMdPaths, roundCtx = {}) {
  const extra =
    reviewer.key === 'claude-md'
      ? '\n\nGoverning `CLAUDE.md` files (paths only — read their contents yourself):\n' +
        bulletList(claudeMdPaths, '(none found)')
      : '';
  const files = bulletList(unit.paths, '');

  return (
    `You are the ${reviewer.title} reviewer. ${reviewer.instruction}\n\n` +
    `Review this unit: "${unit.name}".\n` +
    `Files in scope:\n${files}\n\n` +
    `${SEVERITY_RUBRIC}\n\n` +
    `Return a list of issues. For each: a description, a severity, the category "${reviewer.key}", the primary ` +
    'file and line/range (or the set of files/modules for repo-wide findings), and the reason it was flagged. ' +
    `${REVIEW_RULES}\n\n${FALSE_POSITIVES}${extra}`+
    `${emphasisBlock(roundCtx.round)}${knownFindingsBlock(roundCtx.known)}` +
    `\n\n${surveyBlock(survey)}`
  );
}


// --- Orchestration ------------------------------------------------------------------------------------------------
const gaps = [];

log(`Config — effort: ${effort}, breadth: ${breadth}, depth: ${depth}, maxRounds: ${maxRounds}, scope: ${path || 'whole repo'}.`);

// Phases 1 & 2 — Survey and CLAUDE.md scan, concurrently (both Haiku, full requested effort).
phase('Survey');
const [survey, claudeMd] = await parallel([
  () =>
    agent(surveyPrompt(), {
      label: 'survey',
      phase: 'Survey',
      model: 'haiku',
      effort,
      schema: SURVEY_SCHEMA,
    }),
  () =>
    agent(claudeMdPrompt(), {
      label: 'claude-md-scan',
      phase: 'Survey',
      model: 'haiku',
      effort,
      schema: CLAUDE_MD_SCHEMA,
    }),
]);

if (!survey) {
  return {
    findings: [],
    exclusions: [],
    gaps: ['Survey agent did not return — review aborted (no repository context to work from).'],
  };
}

const claudeMdPaths = claudeMd?.paths ?? [];
if (!claudeMd) {
  gaps.push('`CLAUDE.md` scan did not return — compliance reviewers ran without a governing-file list.');
}

// Phase 3 — Partition (Sonnet, full requested effort).
phase('Partition');
const partition = await agent(partitionPrompt(survey), {
  label: 'partition',
  phase: 'Partition',
  model: 'sonnet',
  effort,
  schema: PARTITION_SCHEMA,
});

if (!partition?.units?.length) {
  return {
    findings: [],
    exclusions: partition?.exclusions ?? [],
    gaps: ['Partition agent did not return usable units — review aborted.'],
  };
}

const units = partition.units;
const exclusions = partition.exclusions || [];

log(`Partitioned into ${units.length} unit(s); ${exclusions.length} exclusion(s).`);

// Phases 4 & 5 — Review + Dedupe, looped until dry. With `--loop` this body repeats up to `maxRounds` times,
// accumulating de-duplicated findings across rounds; without it (`maxRounds === 1`) it runs exactly once — today's
// single pass. Survey and Partition above are computed once and reused; validation below runs once at the end over
// the accumulated set. Round 1 is the baseline pass; rounds 2+ feed each reviewer an escalating emphasis and a
// scoped list of already-reported findings so they look where earlier passes did not. A round that adds no new
// findings after dedup means the review has gone dry.
let deduped = [];
let converged = true;

for (let round = 1; round <= maxRounds; round++) {
  const suffix = round > 1 ? `:r${round}` : '';

  // Review (barrier). Per unit: Agents 1-6 at capped leaf effort. Whole repo: 3 architecture lenses at full effort.
  // This must complete before dedup, which reasons over every finding, so it runs as a single `parallel()` barrier.
  phase('Review');
  const reviewSpecs = [
    ...units.flatMap((unit) =>
      REVIEWERS.map((reviewer) => ({
        label: `review:${unit.name}:${reviewer.key}${suffix}`,
        model: reviewer.model,
        effort: leafEffort,
        category: reviewer.key,
        prompt: reviewerPrompt(reviewer, unit, survey, claudeMdPaths, {
          round,
          known: deduped.filter((f) => f.category === reviewer.key && fileInUnit(f.file, unit)),
        }),
      })),
    ),
    ...ARCHITECTURAL_LENSES.map((lens) => ({
      label: `review:arch:${lens.key}${suffix}`,
      model: 'opus',
      effort,
      category: 'architecture',
      prompt: architecturalLensPrompt(lens, survey, claudeMdPaths, {
        round,
        known: deduped.filter((f) => f.category === 'architecture'),
      }),
    })),
  ];

  const reviewResults = await parallel(
    reviewSpecs.map((spec) => () =>
      agent(spec.prompt, {
        label: spec.label,
        phase: 'Review',
        model: spec.model,
        effort: spec.effort,
        schema: ISSUES_SCHEMA,
      }),
    ),
  );

  const roundIssues = reviewResults.flatMap((result, i) => {
    const spec = reviewSpecs[i];

    if (!result?.issues) {
      gaps.push(`Reviewer did not complete: ${spec.label}`);
      return [];
    }

    return result.issues.map((issue) => ({ ...issue, category: spec.category }));
  });

  log(`Round ${round}: ${roundIssues.length} raw finding(s) across ${reviewSpecs.length} reviewer(s).`);

  if (roundIssues.length === 0) {
    log(`Round ${round} produced no findings — stopping.`);
    break;
  }

  // Dedupe (Opus, one agent). A deterministic script cannot reason over findings, so this is delegated. Merge this
  // round's raw findings into everything accumulated so far; the change in count is the round's novelty signal.
  phase('Dedupe');
  const prevCount = deduped.length;
  const union = [...deduped, ...roundIssues];
  const dd = await agent(dedupePrompt(union), {
    label: `dedupe${suffix}`,
    phase: 'Dedupe',
    model: 'opus',
    effort,
    schema: ISSUES_SCHEMA,
  });

  if (dd?.issues) {
    deduped = dd.issues;
    log(`Deduped round ${round}: ${union.length} -> ${deduped.length} finding(s) (${prevCount} before this round).`);
  } else {
    gaps.push(`Dedupe agent did not return in round ${round} — kept the raw, un-deduplicated findings for this round.`);
    deduped = union;
  }

  // "Dry" = this round added no net-new findings after dedup. Only evaluated when looping; a single pass never checks
  // it. If we exhaust `maxRounds` while a round was still net-positive, the review did not converge.
  if (maxRounds > 1) {
    const netNew = deduped.length - prevCount;

    if (netNew <= 0) {
      log(`Round ${round} added no new findings — converged, stopping.`);
      break;
    }

    if (round === maxRounds) {
      converged = false;
    }
  }
}

if (!converged) {
  gaps.push(
    `Loop hit the ${maxRounds}-round cap while still finding new issues — the review did not converge, so more ` +
      'findings may exist. Re-run with a higher `--loop` cap to keep going.',
  );
}

// Phase 6 — Validate (barrier). Per issue, run `--depth` independent validators; keep on a strict majority of those
// that return. High-risk categories validate with Opus, the rest with Sonnet; both at capped leaf effort.
phase('Validate');
const HIGH_RISK = ['architecture', 'bug', 'consistency', 'security'];
const isHighRisk = (issue) => HIGH_RISK.includes(issue.category);

// With `--depth auto`, high-risk categories get 3 independent validators and the rest get 1; an explicit depth
// applies uniformly. `depth` was normalized to 'auto' or a positive integer at the top, so no parsing here.
const validatorCount = (issue) =>
  depth === 'auto' ? (isHighRisk(issue) ? 3 : 1) : depth;

const verdicts = await parallel(
  deduped.map((issue, idx) => async () => {
    const count = validatorCount(issue);
    const model = isHighRisk(issue) ? 'opus' : 'sonnet';
    const votes = await parallel(
      Array.from({ length: count }, (_, k) => () =>
        agent(validatorPrompt(issue, survey), {
          label: `validate:${issue.category}:${idx}:${k}`,
          phase: 'Validate',
          model,
          effort: leafEffort,
          schema: VERDICT_SCHEMA,
        }),
      ),
    );

    const returned = votes.filter(Boolean);

    if (returned.length === 0) {
      gaps.push(`Validation did not complete for a ${issue.category} finding: ${issue.description.slice(0, 80)}`);
      return null;
    }

    const yes = returned.filter((v) => v.confirmed).length;
    
    // Strict majority of the validators that actually returned (>, not >=, so 1-of-2 is dropped).
    return yes > returned.length / 2 ? issue : null;
  }),
);

const findings = verdicts.filter(Boolean);

log(`Validated ${findings.length} finding(s); ${gaps.length} gap(s).`);

return { findings, exclusions, gaps };
