/**
 * This script is the committed orchestration for the `/repo-review` command. The command (a thin prose wrapper) parses
 * arguments, runs this workflow via the `Workflow` tool, and formats what it returns. All I/O — GitHub permalinks
 * (which need `git`) and writing `--output` — is the wrapper's job, because workflow scripts have no filesystem or git
 * access.
 *
 * Inputs arrive on `args` as `{ path, effort, breadth, depth, loop, fix, reviewers }`, normalized through
 * `normalizeArgs` below because this call site delivers that object JSON-encoded as a string. The return value is
 * `{ findings, exclusions, gaps }`, plus a `fix` object (`{ commits, outcomes }`) when `--fix` was requested.
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
    { title: 'Fix' },
    // Distinct from the 'Review' above, and it must stay distinct: phase titles are matched exactly, so naming this
    // 'Review' too left the fix reviewers with no box of their own — nothing appeared below Fix as its reviews
    // started, which read as though Review were waiting for every fixer to finish when in fact each fix is reviewed
    // the moment it lands. Verb-first, too: 'Fix Review' reads as fixing a review rather than reviewing a fix.
    { title: 'Review Fix' },
    { title: 'Reconcile' },
  ],
};

// --- Argument normalization ---------------------------------------------------------------------------------------
// `args` is meant to arrive as an object, but in practice this call site delivers a JSON-encoded *string*: four
// consecutive launches did so, including one where the caller knew about the defect, was actively trying to avoid it,
// and had just re-read this very code. Neither trusting the shape nor refusing it works. Trusting it is silent and
// expensive — no `args?.foo` lookup on a string can succeed, so every knob below falls back to its default, widening a
// scoped review to the whole repository and turning `--fix` off with only the `Config —` line to give it away.
// Refusing it outright is worse: it fails every invocation. So recover the object here, where the check is
// deterministic, while leaving the object form as what the caller should still send.
function normalizeArgs(value) {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

const input = normalizeArgs(args);

// A string that is not JSON at all cannot be recovered, and proceeding would review the whole repository while
// appearing to honour the caller's arguments. That case does abort — it is unrecoverable rather than merely
// mis-encoded, and costs nothing to reject here, before the first agent. (`typeof null === 'object'`, hence the
// truthiness test first.)
if (typeof args === 'string' && (!input || typeof input !== 'object')) {
  return {
    findings: [],
    exclusions: [],
    gaps: [
      '`args` arrived as a string that is not a JSON object, so no argument could be read and **nothing was ' +
        'reviewed**. Re-run the workflow passing `args` as a JSON object.',
    ],
  };
}

const path = input?.path;
const scope = path ? `the subtree \`${path}\`` : 'the whole repository';
const lsFiles = path ? `git ls-files -- ${path}` : 'git ls-files';


// --- Configuration knobs ------------------------------------------------------------------------------------------
// Each knob tolerates missing or malformed input. `effort` gates every agent (clamped to a known level). `breadth`
// (partition-unit count) and `depth` (validators per finding) accept the sentinel 'auto' or a positive integer.
const EFFORT_ORDER = ['low', 'medium', 'high', 'xhigh', 'max'];
const effort = EFFORT_ORDER.includes(input?.effort) ? input.effort : 'high';

function positiveIntOr(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isNaN(n) || n < 1 ? fallback : n;
}

const breadth = input?.breadth === 'auto' ? 'auto' : positiveIntOr(input?.breadth, 'auto');
const depth = input?.depth === 'auto' ? 'auto' : positiveIntOr(input?.depth, 1);

// `--loop` turns on multi-round "loop-until-dry" reviewing. The wrapper sends `loop: true` for a bare `--loop` and an
// integer for `--loop <n>`; anything absent means a single pass. `maxRounds` caps how many times the Review+Dedupe body
// repeats; the loop stops earlier the first time a round adds no new findings.
const LOOP_DEFAULT_ROUNDS = 4;
const loopEnabled = (input?.loop ?? false) !== false;
const maxRounds = loopEnabled ? positiveIntOr(input?.loop, LOOP_DEFAULT_ROUNDS) : 1;

// `--fix` turns on the optional Fix + Reconcile phases: after validation, one worktree-isolated agent per finding
// tries to fix it and commit, then a reconciliation agent merges any fixes that collide on a shared file. Off by
// default — the review stays strictly read-only unless the wrapper sends `fix: true`.
const fix = input?.fix;

// `--reviewers <n>` gates each applied fix through independent review (approve on a strict majority) with a bounded
// revision loop. 0 disables the Review phase entirely — applied fixes go straight to Reconcile. Default 1. Accepts 0,
// so it needs its own non-negative parser rather than `positiveIntOr`.
function nonNegativeIntOr(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isNaN(n) || n < 0 ? fallback : n;
}
const reviewers = nonNegativeIntOr(input?.reviewers, 1);
const FIX_REVISION_CAP = 2; // up to 2 revisions (3 total fix attempts) before a rejected fix is dropped.


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
    inScopeFileCount: {
      type: 'integer',
      description: 'Number of files in scope — exactly how many paths the enumeration command listed',
    },
    structure: {
      type: 'array',
      description: "The whole repository's top-level directory structure, one entry per directory",
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
  required: ['languages', 'tooling', 'entryPoints', 'inScopeFileCount', 'structure'],
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

// A Fix agent either commits a clean fix ('applied'), refuses because the change is not a safe, localized edit
// ('declined'), or reverts because its change failed in-sandbox verification ('verify-failed').
const FIX_RESULT_SCHEMA = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['applied', 'declined', 'verify-failed'],
    },
    sha: {
      type: 'string',
      description: 'New commit SHA when applied; empty otherwise',
    },
    branch: {
      type: 'string',
      description: 'Branch holding the commit when applied; empty otherwise',
    },
    changedFiles: {
      ...STRING_ARRAY,
      description: 'Repo-relative paths the fix modified (empty when not applied)',
    },
    reason: {
      type: 'string',
      description: 'Note on the fix when applied, or why it was declined / failed',
    },
  },
  required: ['status', 'reason'],
};

// A Reconciliation agent merges a group of colliding fixes into one commit ('resolved') or reports it cannot
// ('failed'), in which case none of the group's fixes are landed.
const RECONCILE_RESULT_SCHEMA = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['resolved', 'failed'],
    },
    sha: {
      type: 'string',
      description: 'Merged commit SHA when resolved; empty otherwise',
    },
    branch: {
      type: 'string',
      description: 'Branch holding the merged commit when resolved; empty otherwise',
    },
    changedFiles: {
      ...STRING_ARRAY,
      description: 'Repo-relative paths the merged commit modified',
    },
    reason: {
      type: 'string',
      description: 'How the fixes were combined, or why reconciliation failed',
    },
  },
  required: ['status', 'reason'],
};

// A Fix reviewer approves a fix commit or rejects it with a specific, actionable objection the reviser can act on.
const REVIEW_RESULT_SCHEMA = {
  type: 'object',
  properties: {
    approved: { type: 'boolean' },
    objection: {
      type: 'string',
      description: 'Empty when approved; otherwise a concise, actionable reason the fix was rejected',
    },
  },
  required: ['approved', 'objection'],
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
  `Survey ${scope} to orient a code review. Use \`${lsFiles}\` to enumerate the files in scope (do not walk the ` +
  'filesystem, so ignored files stay out). Return: the primary programming languages; the build and test tooling; ' +
  'the entry points; the number of files in scope, which is exactly how many paths that command listed and nothing ' +
  "more; and, for orientation only, the whole repository's top-level directory structure with a file count per " +
  'directory. The last two are different numbers whenever a scope narrower than the repository is in effect.';

const validatorPrompt = (issue, survey) =>
  'Independently validate whether the following reported issue is real, with high confidence. Open the actual ' +
  'file(s) yourself — or, for repository-wide findings, the relevant files and structure — rather than trusting the ' +
  'report\'s excerpt. Confirm the specific claim: e.g. if "variable is not defined" was flagged, verify that is ' +
  'actually true in the code; for a `CLAUDE.md` issue, confirm the cited rule is scoped for the file and is actually ' +
  'violated. Confirm only if the issue is truly an issue and significant today ("pre-existing" is not grounds to ' +
  `dismiss it). Return \`{ confirmed, rationale }\`.\n\n` +
  `Issue:\n${JSON.stringify(issue, null, 2)}\n\n${surveyBlock(survey)}`;

const fixerPrompt = (issue, survey, branchName, revisionCtx = null) => {
  const revisionBlock = revisionCtx
    ? '\n\nThis is a REVISION. A previous attempt to fix this issue was reviewed and REJECTED. Inspect that attempt ' +
      `with \`git show ${revisionCtx.priorSha}\`, then produce a better fix that addresses the objection — starting ` +
      `fresh from \`HEAD\`, not building on the rejected commit.\nReviewer objection: ${revisionCtx.objection}`
    : '';

  return (
    'You are a Fix agent working in an isolated git worktree checked out at the repository `HEAD`. Fix exactly ONE ' +
    'already-validated issue — a/find only if you can do so cleanly. A wrong "fix" is worse than none.\n\n' +
    `Issue:\n${JSON.stringify(issue, null, 2)}${revisionBlock}\n\n` +
    'Procedure:\n' +
    '1. Open the cited file(s), confirm the issue, and make the smallest change that correctly fixes it — confined to ' +
    'the cited site and anything in `otherSites`. Do not opportunistically refactor or touch unrelated code.\n' +
    '2. Judge fixability honestly. If this is not a clear, safe, localized edit — an architectural change spanning ' +
    'many files, a judgment call, or anything you are not confident in — make NO change and return ' +
    '`{ status: "declined", reason }`.\n' +
    '3. If you did edit, verify in this worktree using the build/test tooling from the survey below (typecheck and ' +
    'run the tests). If verification fails, revert and return `{ status: "verify-failed", reason }`. If the ' +
    'repository has no runnable typecheck or test suite, skip this step and say so in `reason`.\n' +
    `4. On success, commit on a fresh branch: \`git switch -c ${branchName} && git add -A && git commit\` with a ` +
    'concise message. Do NOT push. Return `{ status: "applied", sha, branch, changedFiles, reason }` — `sha` from ' +
    `\`git rev-parse HEAD\`, \`branch\` = "${branchName}", and \`changedFiles\` listing every repo-relative path you ` +
    'modified. Accurate `changedFiles` is critical: the orchestrator uses it to detect fixes that collide on a ' +
    'shared file.\n\nReturn only the structured result.\n\n' +
    surveyBlock(survey)
  );
};

const reconcilePrompt = (groupFixes, groupIdx, survey) =>
  'You are a Reconciliation agent in an isolated git worktree checked out at the repository `HEAD`. Several independent ' +
  'Fix agents each committed a fix, but their changes touch overlapping files and cannot all be applied as-is. ' +
  'Produce ONE commit off HEAD that coherently applies ALL of their fixes together.\n\n' +
  'Fixes to combine (inspect each with `git show <sha>`):\n' +
  groupFixes
    .map((f) => `- ${f.sha} (${f.branch}) — files: ${(f.changedFiles || []).join(', ')} — ${f.reason}`)
    .join('\n') +
  '\n\nProcedure:\n' +
  "1. Start from `HEAD` and apply each fix in turn (e.g. `git cherry-pick <sha>`), resolving conflicts so every fix's " +
  'intent is preserved and the result is coherent. If two fixes genuinely contradict, prefer the higher-severity ' +
  'intent and note the tradeoff in `reason`.\n' +
  "2. Verify the combined result in this worktree with the survey's build/test tooling. If it cannot be made to " +
  'pass, return `{ status: "failed", reason }`.\n' +
  `3. On success, land the result as a single commit on a fresh branch \`rrmerge/${groupIdx}\` and return ` +
  '`{ status: "resolved", sha, branch, changedFiles, reason }`.\n\nReturn only the structured result.\n\n' +
  surveyBlock(survey);

const fixReviewPrompt = (issue, fixResult, survey) =>
  'You are a Fix reviewer. An automated Fix agent produced a commit intended to resolve the validated issue below. ' +
  'Judge that commit independently — do NOT trust the fixer. Inspect the change read-only with ' +
  `\`git show ${fixResult.sha}\` (do not modify anything, do not run the tests — the fixer already did). Judge two ` +
  'things: (1) correctness — does the change actually resolve the issue as described, with no missed cases; and ' +
  '(2) quality — is it a minimal, idiomatic change confined to the issue that introduces no new bugs, regressions, ' +
  'or unsafe behaviour. Approve only if you are confident on both. If you reject, give a specific, actionable ' +
  'objection the fixer can act on in a revision.\n\n' +
  `Issue:\n${JSON.stringify(issue, null, 2)}\n\n` +
  `Fix commit: ${fixResult.sha} — files: ${(fixResult.changedFiles || []).join(', ') || '(none reported)'}\n` +
  `Fixer's note: ${fixResult.reason}\n\n` +
  'Return `{ approved, objection }` — `objection` empty when approved.\n\n' +
  surveyBlock(survey);

// Group applied fixes into connected components by shared changed file (union-find). Two fixes that modify a common
// file must land together — they would conflict on cherry-pick otherwise — so they go to one reconciliation agent; a
// fix sharing no file with any other is its own singleton group and passes through untouched.
function groupByFileCollision(fixes) {
  const parent = fixes.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const unite = (a, b) => {
    parent[find(a)] = find(b);
  };
  const fileOwner = new Map();

  fixes.forEach((fixResult, i) => {
    (fixResult.changedFiles || []).forEach((file) => {
      if (fileOwner.has(file)) {
        unite(i, fileOwner.get(file));
      } else {
        fileOwner.set(file, i);
      }
    });
  });

  const groups = new Map();
  fixes.forEach((_, i) => {
    const root = find(i);
    if (!groups.has(root)) {
      groups.set(root, []);
    }
    groups.get(root).push(i);
  });

  return [...groups.values()];
}

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

// With `--breadth auto`, scale the unit count to how much code is actually in scope. A fixed 4-8 range suits a whole
// repository but is pathological for a narrow `path` scope: told to find at least four units in a single file, the
// partitioner splits that file into conceptual slices, and since the Review phase is `units × REVIEWERS`, every
// invented slice costs six more reviewers all re-reading the same file. A count of 0 means the survey returned no
// usable in-scope count — treat the scope size as unknown and keep the repository-sized default.
const autoUnitTarget = (fileCount) =>
  !fileCount ? 'the range 4-8'
  : fileCount <= 1 ? 'exactly 1 unit'
  : fileCount <= 5 ? 'the range 1-2'
  : fileCount <= 20 ? 'the range 2-4'
  : 'the range 4-8';

function partitionPrompt(survey, fileCount) {
  const target =
    breadth === 'auto'
      ? `Choose the number of units that best fits the scope, in ${autoUnitTarget(fileCount)}.`
      : `Partition into exactly ${breadth} units.`;

  return (
    `Partition ${scope} into coherent review units, using the survey below. ${target} Each unit should be a module, ` +
    'package, or directory group that can be understood on its own; give it a short name and the list of ' +
    `repo-relative paths it covers (enumerate with \`${lsFiles}\`). Never split a single file across units — a unit is ` +
    'a set of whole files, and each file belongs to exactly one unit. Also return an explicit list of everything you ' +
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

log(
  `Config — effort: ${effort}, breadth: ${breadth}, depth: ${depth}, maxRounds: ${maxRounds}, ` +
    `fix: ${fix ? 'on' : 'off'}, reviewers: ${reviewers}, scope: ${path || 'whole repo'}.`,
);

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

// How much code is in scope, used below to scale the `auto` breadth range — a range right-sized for a repository is
// pathological for a `path` scope of a file or two. This must come from the survey's dedicated in-scope count and not
// from summing `structure`: `structure` describes the whole repository whatever the scope, so summing it reported ~170
// files for a single-file review and the range never narrowed. 0 means no usable count — treated as unknown, keeping
// the repository-sized default rather than guessing small.
const surveyedFiles =
  Number.isInteger(survey.inScopeFileCount) && survey.inScopeFileCount > 0 ? survey.inScopeFileCount : 0;

log(
  surveyedFiles
    ? `${surveyedFiles} file(s) in scope.`
    : 'Survey returned no in-scope file count — sizing the review with repository-wide defaults.',
);

// Phase 3 — Partition (Sonnet, full requested effort).
phase('Partition');
const partition = await agent(partitionPrompt(survey, surveyedFiles), {
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

// The distinct files the reviewers will actually open. This, not the survey's count, is what the lens gate below keys
// on: it is the review's real scope, already narrowed by the partitioner's exclusions, and it cannot be inflated by a
// surveyor answering a repository-shaped question about a one-file scope.
const unitFiles = new Set(units.flatMap((unit) => unit.paths || [])).size;

log(`Partitioned into ${units.length} unit(s) over ${unitFiles} file(s); ${exclusions.length} exclusion(s).`);

// Phases 4 & 5 — Review + Dedupe, looped until dry. With `--loop` this body repeats up to `maxRounds` times,
// accumulating de-duplicated findings across rounds; without it (`maxRounds === 1`) it runs exactly once — today's
// single pass. Survey and Partition above are computed once and reused; validation below runs once at the end over
// the accumulated set. Round 1 is the baseline pass; rounds 2+ feed each reviewer an escalating emphasis and a
// scoped list of already-reported findings so they look where earlier passes did not. A round that adds no new
// findings after dedup means the review has gone dry.
let deduped = [];
let converged = true;

// The architecture lenses assess repository-level structure, so on a scope of one or two files there is nothing
// structural to assess — three whole-repo Opus agents would return noise at best. Skip them below that threshold and
// record it: a lens that never ran must not read as "architecture: clean". An unknown scope size still runs them.
const runLenses = !unitFiles || unitFiles > 2;

if (!runLenses) {
  gaps.push(`Architecture lenses not run: only ${unitFiles} file(s) in scope — too small for a structural review.`);
}

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
    ...(runLenses
      ? ARCHITECTURAL_LENSES.map((lens) => ({
          label: `review:arch:${lens.key}${suffix}`,
          model: 'opus',
          effort,
          category: 'architecture',
          prompt: architecturalLensPrompt(lens, survey, claudeMdPaths, {
            round,
            known: deduped.filter((f) => f.category === 'architecture'),
          }),
        }))
      : []),
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

// --- Agent labels for the per-finding phases -----------------------------------------------------------------------
// One handle per finding, shared by every agent that touches it — validator, fixer, reviser, fix reviewer — so a single
// finding can be followed across phases in the progress tree. The number is the same index the fixer's branch uses
// (`rrfix/<n>`), so a label points at its branch without arithmetic.
const findingTag = (issue, idx) => `${issue.category}#${idx}`;

// Name a member of a redundant group only when the group has more than one member. `vote 1/1` is noise, and under the
// default `--depth 1` / `--reviewers 1` every label would carry it — which is how `validate:bug:3:0` came to end in a
// constant `:0` that looked like it meant something.
const voteTag = (k, count) => (count > 1 ? ` vote ${k + 1}/${count}` : '');

// Attempt 0 is the original fix; only the revisions need saying, counted from 1 as attempts rather than from 0.
const attemptTag = (attempt) => (attempt > 0 ? ` attempt ${attempt + 1}` : '');

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
          label: `validate:${findingTag(issue, idx)}${voteTag(k, count)}`,
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

// Without `--fix`, or with nothing to fix, the review is strictly read-only — return here.
if (!fix || findings.length === 0) {
  return { findings, exclusions, gaps };
}

// Phases 7 & 7.5 — Fix, then Review, per finding and concurrent. Each validated finding runs its own pipeline: a
// worktree-isolated Fix agent edits, verifies in its sandbox, and commits only a clear, safe, localized change (Opus
// for high-risk categories, Sonnet otherwise, at capped leaf effort). Then, unless `--reviewers 0` disabled it,
// `reviewers` read-only reviewers judge the commit for correctness and quality and approve on a strict majority. A
// rejected fix is handed back to a fresh Fix agent — given the rejected diff and the objection — up to
// `FIX_REVISION_CAP` times, re-reviewing each attempt. Only an approved commit reaches Reconcile; declined,
// verify-failed, and review-rejected findings are reported unfixed. Findings are independent until Reconcile, so the
// whole fix→review→revise loop runs concurrently across them; isolation keeps their parallel edits from colliding.
phase('Fix');

// Run a Fix agent: attempt 0 is the initial fix (Fix phase); later attempts are revisions (Review Fix phase) that see
// the prior rejected commit and the objection. Each attempt commits on its own branch so branch names never collide.
const runFixer = (issue, idx, attempt, revisionCtx) => {
  const branch = attempt === 0 ? `rrfix/${idx}` : `rrfix/${idx}-r${attempt}`;
  const tag = findingTag(issue, idx);

  return agent(fixerPrompt(issue, survey, branch, revisionCtx), {
    label: attempt === 0 ? `fix:${tag}` : `revise:${tag}${attemptTag(attempt)}`,
    phase: attempt === 0 ? 'Fix' : 'Review Fix',
    model: isHighRisk(issue) ? 'opus' : 'sonnet',
    effort: leafEffort,
    isolation: 'worktree',
    schema: FIX_RESULT_SCHEMA,
  });
};

// Run `reviewers` read-only reviewers over one fix commit; approve on a strict majority of those that return. When no
// reviewer returns at all, the gate could not run — signal that (completed: false) rather than silently approving.
const reviewFix = async (issue, current, idx, rev) => {
  const model = isHighRisk(issue) ? 'opus' : 'sonnet';
  const votes = await parallel(
    Array.from({ length: reviewers }, (_, k) => () =>
      agent(fixReviewPrompt(issue, current, survey), {
        label: `review-fix:${findingTag(issue, idx)}${attemptTag(rev)}${voteTag(k, reviewers)}`,
        phase: 'Review Fix',
        model,
        effort: leafEffort,
        schema: REVIEW_RESULT_SCHEMA,
      }),
    ),
  );

  const returned = votes.filter(Boolean);

  if (returned.length === 0) {
    gaps.push(`Fix review did not complete for a ${issue.category} finding: ${issue.description.slice(0, 80)}`);

    return {
      completed: false,
      approved: false,
      objection: 'review did not complete',
    };
  }

  const yes = returned.filter((v) => v.approved).length;
  const objection = returned.filter((v) => !v.approved && v.objection).map((v) => v.objection).join('; ');

  // Strict majority of the reviewers that actually returned (>, not >=, so 1-of-2 is a rejection).
  return {
    completed: true,
    approved: yes > returned.length / 2,
    objection,
  };
};

const asOutcome = (issue, result) => ({
  issue,
  status: result.status,
  sha: result.sha,
  branch: result.branch,
  changedFiles: result.changedFiles || [],
  reason: result.reason,
});

// The full fix→review→revise loop for one finding. Returns its final per-finding outcome.
const fixAndReview = async (issue, idx) => {
  let current = await runFixer(issue, idx, 0, null);

  if (!current) {
    gaps.push(`Fix agent did not return for a ${issue.category} finding: ${issue.description.slice(0, 80)}`);

    return {
      issue,
      status: 'verify-failed',
      reason: 'fix agent did not return',
      changedFiles: [],
    };
  }

  // Nothing committed (declined / verify-failed), or review disabled with `--reviewers 0`: take the fix as-is.
  if (current.status !== 'applied' || !current.sha || reviewers === 0) {
    return asOutcome(issue, current);
  }

  for (let rev = 0; rev <= FIX_REVISION_CAP; rev++) {
    const review = await reviewFix(issue, current, idx, rev);

    if (review.approved) {
      return asOutcome(issue, current);
    }

    // Review could not run (no reviewer returned): don't spend revisions on an infrastructure gap — drop, unfixed.
    if (!review.completed) {
      return { issue, status: 'review-rejected', reason: review.objection, changedFiles: current.changedFiles || [] };
    }

    // Out of revision attempts: the fix stays rejected and unfixed.
    if (rev === FIX_REVISION_CAP) {
      return {
        issue,
        status: 'review-rejected',
        reason: review.objection || 'fix rejected by review',
        changedFiles: current.changedFiles || [],
      };
    }

    // Revise: a fresh Fix agent starts from HEAD with the rejected diff and the objection.
    const revised = await runFixer(issue, idx, rev + 1, { priorSha: current.sha, objection: review.objection });

    if (!revised) {
      gaps.push(`Revision agent did not return for a ${issue.category} finding: ${issue.description.slice(0, 80)}`);

      return {
        issue,
        status: 'verify-failed',
        reason: 'revision agent did not return',
        changedFiles: [],
      };
    }

    // Reviser declined or its change failed verification: that terminal status stands (no further revisions).
    if (revised.status !== 'applied' || !revised.sha) {
      return asOutcome(issue, revised);
    }

    current = revised;
  }
};

// A throw inside this pipeline is infrastructure, not a verdict on the finding: the agent never got to judge it. Catch
// it here rather than letting `parallel` flatten it to a bare `null`, because the message names the cause — a worktree
// that could not be created, say — and that is the one piece of information needed to fix the run. `parallel` logs it,
// but the workflow's return value is what the wrapper reports, and the log is not in it.
const pipelineErrors = [];
const rawOutcomes = await parallel(
  findings.map((issue, idx) => async () => {
    try {
      return await fixAndReview(issue, idx);
    } catch (error) {
      pipelineErrors.push(String(error?.message || error).split('\n').slice(0, 3).join(' — '));
      return null;
    }
  }),
);

const outcomes = rawOutcomes.map((outcome, idx) =>
  outcome ?? {
    issue: findings[idx],
    status: 'verify-failed',
    reason: 'fix/review pipeline did not return',
    changedFiles: [],
  },
);

// A pipeline that never returned is not a finding that survived scrutiny, and `verify-failed` alone reads as though one
// did. When every pipeline dies the same way, the per-finding statuses show nine independent verification failures and
// the phase-wide cause appears nowhere in the result. Say it once, plainly, with the underlying error attached.
const unreturned = rawOutcomes.filter((outcome) => !outcome).length;
if (unreturned) {
  const causes = [...new Set(pipelineErrors)].slice(0, 2);
  gaps.push(
    (unreturned === findings.length
      ? `The Fix phase did not run: all ${unreturned} fix pipeline(s) failed before returning`
      : `${unreturned} of ${findings.length} fix pipeline(s) failed before returning`) +
      `, so those findings were never fixed and are **not** verified as unfixable.${
        causes.length ? ` Cause: ${causes.join(' | ')}` : ''
      }`,
  );
}

const applied = outcomes.filter((outcome) => outcome.status === 'applied' && outcome.sha);
log(
  `Fix/Review: ${applied.length} approved, ${outcomes.length - applied.length} unfixed ` +
    '(declined / verify-failed / review-rejected).',
);

// Phase 8 — Reconcile (barrier). Fixes that touch a shared file are merged by a reconciliation agent into one
// coherent commit; fixes that collide with nothing pass through as-is. The result is a conflict-free, ordered list of
// commits (each touching a disjoint set of files, all based on HEAD) for the wrapper to cherry-pick without conflict.
phase('Reconcile');
const groups = groupByFileCollision(applied);
const reconciled = await parallel(
  groups.map((group, gi) => async () => {
    const groupFixes = group.map((i) => applied[i]);

    // Singleton group: the fixer's own commit lands unchanged.
    if (groupFixes.length === 1) {
      const only = groupFixes[0];

      return {
        sha: only.sha,
        findings: [only.issue],
        changedFiles: only.changedFiles,
      };
    }

    // As in the Fix phase, a throw here must not escape the thunk: `parallel` would return `null` for this group, the
    // `filter(Boolean)` below would drop it from `commits`, and its fixes would keep `status: 'applied'` with a SHA
    // nothing ever cherry-picks — reported as landed while silently lost. Fold it into the failure branch instead.
    let rr = null;
    let rrError = '';

    // Name the group by the findings it merges rather than by its position in the group list, which said nothing about
    // what was being reconciled: `reconcile:bug#3+security#7`.
    const merging = groupFixes.map((groupFix) => findingTag(groupFix.issue, findings.indexOf(groupFix.issue)));
    const mergeTag = merging.slice(0, 3).join('+') + (merging.length > 3 ? `+${merging.length - 3} more` : '');

    try {
      rr = await agent(reconcilePrompt(groupFixes, gi, survey), {
        label: `reconcile:${mergeTag}`,
        phase: 'Reconcile',
        model: 'opus',
        effort,
        isolation: 'worktree',
        schema: RECONCILE_RESULT_SCHEMA,
      });
    } catch (error) {
      rrError = String(error?.message || error).split('\n').slice(0, 3).join(' — ');
    }

    if (rr?.status === 'resolved' && rr.sha) {
      return {
        sha: rr.sha,
        findings: groupFixes.map((finding) => finding.issue),
        changedFiles: rr.changedFiles || [],
      };
    }

    // Reconciliation failed: none of the colliding group's fixes can be landed together. Mark them conflict-skipped.
    const files = [...new Set(groupFixes.flatMap((fix) => fix.changedFiles))].join(', ');
    groupFixes.forEach((fix) => {
      const outcome = outcomes.find((outcome) => outcome.issue === fix.issue);

      if (outcome) {
        outcome.status = 'conflict-skipped';
        outcome.reason = rr?.reason || rrError || 'reconciliation failed';
        outcome.sha = undefined;
      }
    });

    gaps.push(
      `Reconciliation failed for ${groupFixes.length} colliding fix(es) on ${files} — left unfixed.${
        rrError ? ` Cause: ${rrError}` : ''
      }`,
    );
    return null;
  }),
);

const commits = reconciled.filter(Boolean);

// A merged commit carries more than one finding: mark those findings conflict-resolved and point them at the merged
// commit's SHA (the individual fixer commits are superseded and never cherry-picked).
commits.forEach((commit) => {
  if (commit.findings.length > 1) {
    commit.findings.forEach((issue) => {
      const outcome = outcomes.find((x) => x.issue === issue);

      if (outcome?.status === 'applied') {
        outcome.status = 'conflict-resolved';
        outcome.sha = commit.sha;
      }
    });
  }
});

log(`Reconcile: ${commits.length} conflict-free commit(s) from ${applied.length} applied fix(es).`);

// The wrapper creates the fix branch off HEAD and cherry-picks `commits` in order; every commit touches a disjoint
// set of files, so the cherry-picks cannot conflict. `outcomes` carries the per-finding result for the report.
return {
  findings,
  exclusions,
  gaps,
  fix: {
    commits: commits.map((commit) => ({
      sha: commit.sha,
      changedFiles: commit.changedFiles,
      findingCount: commit.findings.length,
    })),
    outcomes: outcomes.map((outcome) => ({
      description: outcome.issue.description,
      category: outcome.issue.category,
      severity: outcome.issue.severity,
      file: outcome.issue.file,
      lines: outcome.issue.lines,
      status: outcome.status,
      sha: outcome.sha,
      reason: outcome.reason,
    })),
  },
};
