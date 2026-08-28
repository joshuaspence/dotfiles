/**
 * This script is the committed orchestration for the `/repo-review` command. The command (a thin prose wrapper) parses
 * arguments, runs this workflow via the `Workflow` tool, and formats what it returns. All I/O — GitHub permalinks
 * (which need `git`) and writing `--output` — is the wrapper's job, because workflow scripts have no filesystem or git
 * access.
 *
 * Inputs arrive on `args` as `{ paths, effort, partitions, validators, loop, fix, reviewers }`, normalized through
 * `normalizeArgs` below because this call site delivers that object JSON-encoded as a string. The return value is
 * `{ findings, exclusions, gaps }`, plus a `fix` object (`{ base, sandboxBranches, commits, outcomes }`) when `--fix`
 * was requested.
 *
 * Because this script has no git access, everything the `--fix` phases claim about their commits — the base they are
 * parented on, the files they touch — is self-reported by the agents that made them, and has been wrong in practice
 * (see `pinToReviewHead`). The script pins what it can and drops what it can disprove; `fix.base` is returned so the
 * wrapper can re-establish the invariant against git before it lands anything.
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

// `paths` scopes the review to one or more subtrees. The wrapper sends an array, but a lone string and the older
// singular `path` key are both accepted: a shape mismatch here does not fail loudly, it silently reviews the whole
// repository while every later phase behaves correctly for that wider scope, so there is nothing downstream to catch
// it. Blank entries are dropped and duplicates collapsed, since `git ls-files -- src src` double-counts nothing but a
// duplicate still reaches the agents as prose implying two distinct scopes.
function normalizePaths(value) {
  const list = Array.isArray(value) ? value : [value];

  return [...new Set(list.filter((p) => typeof p === 'string' && p.trim() !== '').map((p) => p.trim()))];
}

const paths = normalizePaths(input?.paths ?? input?.path);

// The scope rendered three ways: as a backticked list for prose, as the phrase naming it, and as the pathspec the
// agents enumerate with. Each path is quoted in the pathspec — with several of them, an unquoted path containing a
// space would split into two pathspecs and widen the scope rather than fail.
const pathList = paths.map((p) => `\`${p}\``).join(', ');
const scope =
  paths.length === 0 ? 'the whole repository'
  : paths.length === 1 ? `the subtree ${pathList}`
  : `the subtrees ${pathList}`;
const lsFiles = paths.length ? `git ls-files -- ${paths.map((p) => `'${p}'`).join(' ')}` : 'git ls-files';


// --- Configuration knobs ------------------------------------------------------------------------------------------
// Each knob tolerates missing or malformed input. `effort` gates every agent (clamped to a known level). `partitions`
// (review units) and `validators` (validators per finding) accept the sentinel 'auto' or a positive integer.
const EFFORT_ORDER = ['low', 'medium', 'high', 'xhigh', 'max'];
const effort = EFFORT_ORDER.includes(input?.effort) ? input.effort : 'high';

function positiveIntOr(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isNaN(n) || n < 1 ? fallback : n;
}

const partitions = input?.partitions === 'auto' ? 'auto' : positiveIntOr(input?.partitions, 'auto');
const validators = input?.validators === 'auto' ? 'auto' : positiveIntOr(input?.validators, 1);

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
// revision loop. 0 disables the Review Fix phase entirely — applied fixes go straight to Reconcile. Default 1. It
// accepts 0, so it needs its own non-negative parser rather than `positiveIntOr`.
function nonNegativeIntOr(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isNaN(n) || n < 0 ? fallback : n;
}
const reviewers = nonNegativeIntOr(input?.reviewers, 1);
const FIX_REVISION_CAP = 2; // up to 2 revisions (3 total fix attempts) before a rejected fix is dropped.


// --- Effort caps -----------------------------------------------------------------------------------------------------
// Clamp a requested effort down to a ceiling, never up: asking for `low` gets `low` everywhere.
const capEffort = (e, ceiling) => (EFFORT_ORDER.indexOf(e) > EFFORT_ORDER.indexOf(ceiling) ? ceiling : e);

// The per-unit reviewers (Review phase) and the validators (Validate phase) run at high multiplicity; launching many
// concurrent `max` Opus inferences has been observed to intermittently stall, and the Review phase is a barrier, so a
// single hung agent can wedge the run. Cap those leaf agents at `xhigh`. The surveyors, the partitioner and the three
// architecture lenses keep the requested effort.
const capLeaf = (e) => capEffort(e, 'xhigh');
const leafEffort = capLeaf(effort);

// Dedupe gets a tighter ceiling still, for a different reason. The harness kills any agent that makes no progress for
// 180s, and dedupe is a single fan-in agent with no tools to call, so it streams nothing at all until its first token —
// there is no progress to report while it thinks. A 155-finding round at `max` hit that watchdog on all six attempts
// (`agent stalled on all 6 attempts (no progress for 180000ms each)`), while a reviewer in the same run spent 296s on a
// 32k-character thinking block and was fine, because its tool calls kept reporting progress. The same prompt at `high`
// reached its first token in 107s. So start at `high` and step down on a stall, never exceeding what was requested:
// under the indices-only contract this is shallow judgement ("is finding i the same defect as finding j?"), so the
// lower rung costs little.
const DEDUPE_EFFORT_LADDER = ['high', 'medium'];
const dedupeEfforts = [...new Set(DEDUPE_EFFORT_LADDER.map((e) => capEffort(e, effort)))];


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

// What the dedupe agent returns: which findings are duplicates, as indices — never the findings themselves. See
// `dedupePrompt` for why echoing them back is not an option.
const DEDUPE_SCHEMA = {
  type: 'object',
  properties: {
    groups: {
      type: 'array',
      description:
        'One entry per set of duplicates, each an array of two or more indices from the numbered list. Leave out ' +
        'findings that have no duplicate, and never list an index in more than one group.',
      items: { type: 'array', items: { type: 'integer' } },
    },
  },
  required: ['groups'],
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
    // The exact commit the review reads. Everything the `--fix` phases do is defined relative to it, and nothing
    // downstream can discover it for itself: a fix agent's worktree is NOT checked out here (see `reviewHead` below),
    // so `git rev-parse HEAD` inside one answers a different question. This is the only place it can come from.
    headSha: {
      type: 'string',
      description:
        'The full 40-character output of `git rev-parse HEAD` — the exact commit whose contents you surveyed. Run ' +
        'that command and return what it printed; do not abbreviate it and do not substitute a branch name.',
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
  required: ['languages', 'tooling', 'entryPoints', 'inScopeFileCount', 'structure', 'headSha'],
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
      description: 'New commit SHA (hex, from `git rev-parse HEAD`) when applied; empty otherwise',
    },
    // Reported whatever the outcome, unlike `sha`. The branch is created in step 0 — before the fix is even attempted —
    // so a declined or failed fixer has still left one behind, and a branch nobody reports is a branch nobody deletes:
    // the next run then trips over it. This is the teardown list, not a record of success.
    branch: {
      type: 'string',
      description:
        'The branch you created in step 0. Report it whatever the outcome — including when you declined or failed — ' +
        'because it has to be cleaned up afterwards. Empty only if you never created one',
    },
    changedFiles: {
      ...STRING_ARRAY,
      description:
        'Every repo-relative path the fix modified; must be complete and non-empty when applied, since collision ' +
        'detection keys on it. Empty only when nothing was committed',
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
      description: 'Merged commit SHA (hex, from `git rev-parse HEAD`) when resolved; empty otherwise',
    },
    // As with a fix result: created in step 0, so report it even when reconciliation failed, or it never gets deleted.
    branch: {
      type: 'string',
      description:
        'The branch you created in step 0. Report it whatever the outcome — including when reconciliation failed — ' +
        'because it has to be cleaned up afterwards. Empty only if you never created one',
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


// --- Untrusted git identifiers -------------------------------------------------------------------------------------
// Every commit and branch name this script handles is a model-supplied string that ends up on a `git` command line:
// interpolated into the `git show` / `git switch` / `git cherry-pick` instructions of downstream prompts, and handed to
// the wrapper, which cherry-picks under a pre-authorized `Bash(git cherry-pick:*)`. The agents supplying them read the
// repository under review, so they are untrusted input — a returned `sha` of `HEAD; <command>` reads to the next agent
// as an instruction to run `<command>`. Accept only a bare hex object name and a plain branch name; anything else is
// not a commit that can be landed anyway, so the result is refused rather than passed along. These are defined here
// rather than beside the Fix phase because the survey's `headSha` is checked with them too, long before a fix runs.
const isCommitSha = (value) => typeof value === 'string' && /^[0-9a-fA-F]{7,40}$/.test(value);
const isSafeBranchName = (value) =>
  typeof value === 'string' && /^[0-9A-Za-z][0-9A-Za-z._/-]*$/.test(value) && !value.includes('..');


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

// --- Dedupe: the agent judges, the script copies -------------------------------------------------------------------
// This phase used to hand the agent the whole union as JSON and ask it to return the merged findings, which made it
// reproduce every finding verbatim — ~50k output tokens for a 178-finding round, from a 162k-character prompt where the
// digest below needs 53k for a comparable round.
//
// That was NOT what kept killing the phase: the 180s no-progress watchdog was, at both contracts and every high effort
// tier (see the effort ladder above). The split is kept because it is right on its own terms. Deciding *which* findings
// collide is judgement; restating them is a copy — the expensive part, and the part a model can silently get wrong by
// rewording, truncating, dropping, or reordering. Order matters especially: the per-finding validator and fixer labels
// index into this array, and the old contract let the agent choose it. So the agent returns indices only and
// `mergeIssueGroups` does the copying below, where none of that is possible. Leaving ~3x less input to reason over is
// margin against that same watchdog, but margin is all it is — the effort ladder is the actual fix.

// How much of each description the agent sees. Enough to recognise the same defect described twice; short enough that
// the prompt does not grow without bound in the finding count.
const DEDUPE_DESCRIPTION_BUDGET = 300;

const issueSite = (issue) => (issue?.lines ? `${issue.file}:${issue.lines}` : issue?.file || '');

const dedupeDigest = (issues) =>
  issues
    .map((issue, i) => {
      const description = (issue?.description || '').replace(/\s+/g, ' ').slice(0, DEDUPE_DESCRIPTION_BUDGET);

      return `${i}. [${issue?.severity}/${issue?.category}] ${issueSite(issue)} — ${description}`;
    })
    .join('\n');

const dedupePrompt = (issues) =>
  'Identify the genuine duplicates among the following review findings. Two findings are duplicates when they share ' +
  'a root cause, or name the same file, line, and category. When in doubt, keep them separate — a false merge hides ' +
  'a real defect behind an unrelated one.\n\n' +
  'Return `groups`: one array of indices per set of duplicates, using the numbers in the list below. Every index in ' +
  'a group must refer to the same underlying defect. Give a group only when it has two or more members, never list ' +
  'an index in more than one group, and leave out every finding that has no duplicate — a finding you do not ' +
  'mention is kept exactly as it is. Do not restate the findings themselves; the indices are the whole answer.\n\n' +
  'Answer from the list alone: do not read files and do not run any commands, since everything you need is below.\n\n' +
  `Findings (${issues.length}):\n${dedupeDigest(issues)}`;

// Severity is merged upward, so a duplicate reported once as `critical` and once as `low` survives as `critical`.
const SEVERITY_ORDER = ['low', 'medium', 'high', 'critical'];

const worstSeverity = (a, b) => (SEVERITY_ORDER.indexOf(b) > SEVERITY_ORDER.indexOf(a) ? b : a);

// Apply the agent's groups to the findings it was shown. Every field is copied from the originals; the agent's answer
// only decides *which* findings collapse. Malformed groups degrade to "not merged" rather than corrupting the set: an
// out-of-range, non-integer, or already-claimed index is dropped, and a group left with fewer than two members is
// ignored. First group to claim an index wins, so overlapping groups cannot delete a finding twice.
const mergeIssueGroups = (issues, groups) => {
  const claimed = new Set();
  const primaries = new Map();

  for (const group of Array.isArray(groups) ? groups : []) {
    const members = [
      ...new Set(
        (Array.isArray(group) ? group : []).filter(
          (i) => Number.isInteger(i) && i >= 0 && i < issues.length && !claimed.has(i),
        ),
      ),
    ].sort((a, b) => a - b);

    if (members.length < 2) continue;

    members.forEach((i) => claimed.add(i));
    primaries.set(members[0], members);
  }

  // Rebuilt in the original order: the primary keeps its place, so a dropped group changes nothing but the merge.
  return issues.flatMap((issue, i) => {
    if (!primaries.has(i)) return claimed.has(i) ? [] : [issue];

    const members = primaries.get(i);
    const others = members.slice(1).map((j) => issues[j]);
    const primarySite = issueSite(issue);
    const otherSites = [
      ...new Set([
        ...(issue.otherSites || []),
        ...others.flatMap((other) => [issueSite(other), ...(other.otherSites || [])]),
      ]),
    ].filter((site) => site && site !== primarySite);

    return [{ ...issue, severity: members.map((j) => issues[j].severity).reduce(worstSeverity), otherSites }];
  });
};

const surveyPrompt = () =>
  `Survey ${scope} to orient a code review. Use \`${lsFiles}\` to enumerate the files in scope (do not walk the ` +
  'filesystem, so ignored files stay out). Return: the primary programming languages; the build and test tooling; ' +
  'the entry points; the number of files in scope, which is exactly how many paths that command listed and nothing ' +
  "more; and, for orientation only, the whole repository's top-level directory structure with a file count per " +
  'directory. The last two are different numbers whenever a scope narrower than the repository is in effect. ' +
  'Finally, run `git rev-parse HEAD` and return its full 40-character output as `headSha` — the commit the rest of ' +
  'this review is defined against.';

const validatorPrompt = (issue, survey) =>
  'Independently validate whether the following reported issue is real, with high confidence. Open the actual ' +
  'file(s) yourself — or, for repository-wide findings, the relevant files and structure — rather than trusting the ' +
  'report\'s excerpt. Confirm the specific claim: e.g. if "variable is not defined" was flagged, verify that is ' +
  'actually true in the code; for a `CLAUDE.md` issue, confirm the cited rule is scoped for the file and is actually ' +
  'violated. Confirm only if the issue is truly an issue and significant today ("pre-existing" is not grounds to ' +
  `dismiss it). Return \`{ confirmed, rationale }\`.\n\n` +
  `Issue:\n${JSON.stringify(issue, null, 2)}\n\n${surveyBlock(survey)}`;

// --- Pinning a sandbox to the reviewed commit ----------------------------------------------------------------------
// The single most important instruction in the `--fix` pipeline, and the one whose absence broke it. `isolation:
// 'worktree'` does NOT check the worktree out at the repository's local `HEAD`: it creates a branch
// `worktree-wf_<id>-<n>` at the *remote* default branch. In one observed run every one of 81 sandboxes was based on
// `refs/remotes/origin/master`, 126 commits behind the `HEAD` the reviewers had actually read. Two things follow, and
// both bit:
//
//   1. The fixers read and edited 126-commit-stale source while the findings described current source. That is not
//      recoverable downstream — no later rebase can repair a change reasoned about against text that no longer exists.
//   2. The bases diverged *unpredictably*, because pinning was left to agent initiative. Some fixers noticed the
//      mismatch and re-based onto local `master` on their own; most committed straight onto the stale base. "Same
//      base" plus "disjoint files" is what makes the wrapper's cherry-picks commutative, so scattered bases silently
//      void the conflict-free guarantee the wrapper is told it can rely on.
//
// So the base is pinned explicitly, to a SHA the surveyor captured before any of this ran, and the agent is told to
// verify the pin took rather than assume it. `<RUN>` makes the branch name unique to this workflow run: the fixers
// used to restart at `rrfix/0` every run, so a run that ended without teardown left a `rrfix/0` that made the next
// run's `git switch -c rrfix/0` fail outright.
const pinToReviewHead = (reviewHead, kind, suffix, onFailure) =>
  '0. PIN YOUR BASE — do this before opening a single file. Your worktree is **not** checked out at the commit under ' +
  'review. The harness created it at the *remote* default branch, which can be far behind the local `HEAD` this ' +
  'review actually read (126 commits behind, in one observed run). Every file you would open right now is therefore ' +
  'potentially a stale copy, and a commit parented here cannot be cherry-picked cleanly.\n' +
  '   a. Read your sandbox branch name with `git rev-parse --abbrev-ref HEAD`. It has the form ' +
  '`worktree-<runId>-<agentNumber>`, e.g. `worktree-wf_4b3a8931-fda-147`. Derive `<RUN>` from it by stripping the ' +
  'leading `worktree-` and the trailing `-<agentNumber>`, leaving the run id itself (`wf_4b3a8931-fda` in that ' +
  'example). Follow that rule exactly — every agent in this run must derive the *same* `<RUN>`, so do not shorten it ' +
  'further or invent your own abbreviation. It scopes your branch to this run, so it cannot collide with a leftover ' +
  'branch from an earlier run, and it tells the orchestrator which branches to tear down afterwards.\n' +
  `   b. Create your working branch at the reviewed commit: \`git switch -c ${kind}/<RUN>/${suffix} ${reviewHead}\`.\n` +
  `   c. Verify the pin took: \`git rev-parse HEAD\` must print exactly \`${reviewHead}\`. Only once it does may you ` +
  `read or edit anything. If it does not, ${onFailure}\n` +
  '   Everything below assumes you are on that branch, at that commit.\n';

// Paths the partitioner excluded as generated/build output. A fix that regenerates one of these makes itself collide
// with every other fix that regenerated the same artifact: in one run four independent fixes each rebuilt
// `dist/server.cjs`, which union-found them into a single 30-finding reconciliation group whose merged commit then
// touched 25 files and overlapped three unrelated commits. Naming them in the prompt is the cheap half of the fix; the
// script also refuses such a commit below, because prose alone did not hold.
const generatedPathsBlock = (generatedPaths) =>
  generatedPaths.length
    ? '\n\nGenerated / build-output paths — NEVER stage these, even if your verification step rewrote them. If your ' +
      'fix cannot be expressed without regenerating one, commit only the source change and say so in `reason`; the ' +
      'artifact is rebuilt downstream, and committing it makes your fix collide with every other fix that also ' +
      `rebuilt it:\n${bulletList(generatedPaths, '')}`
    : '';

const fixerPrompt = (issue, survey, reviewHead, branchSuffix, generatedPaths, revisionCtx = null) => {
  const revisionBlock = revisionCtx
    ? '\n\nThis is a REVISION. A previous attempt to fix this issue was reviewed and REJECTED. Inspect that attempt ' +
      `with \`git show ${revisionCtx.priorSha}\`, then produce a better fix that addresses the objection — starting ` +
      `fresh from \`HEAD\`, not building on the rejected commit.\nReviewer objection: ${revisionCtx.objection}`
    : '';

  return (
    'You are a Fix agent working in an isolated git worktree. Fix exactly ONE already-validated issue — and only if ' +
    'you can do so cleanly. A wrong "fix" is worse than none.\n\n' +
    `Issue:\n${JSON.stringify(issue, null, 2)}${revisionBlock}\n\n` +
    'Procedure:\n' +
    pinToReviewHead(
      reviewHead,
      'rrfix',
      branchSuffix,
      'make NO change and return `{ status: "declined", reason }` naming the SHA you got instead — a fix built on the ' +
        'wrong base is worse than no fix, because it looks landable and is not.',
    ) +
    '1. Open the cited file(s), confirm the issue is still present at this commit, and make the smallest change that ' +
    'correctly fixes it — confined to the cited site and anything in `otherSites`. Do not opportunistically refactor ' +
    'or touch unrelated code. If the issue does not exist in the code you are now looking at, make NO change and ' +
    'return `{ status: "declined", reason }` saying so.\n' +
    '2. Judge fixability honestly. If this is not a clear, safe, localized edit — an architectural change spanning ' +
    'many files, a judgment call, or anything you are not confident in — make NO change and return ' +
    '`{ status: "declined", reason }`. Report `branch` even then: you created it in step 0, and it has to be torn ' +
    'down afterwards whether or not it carries a commit.\n' +
    '3. If you did edit, verify in this worktree using the build/test tooling from the survey below (typecheck and ' +
    'run the tests). If verification fails, revert and return `{ status: "verify-failed", reason }`. If the ' +
    'repository has no runnable typecheck or test suite, skip this step and say so in `reason`.\n' +
    '4. On success, stage ONLY the files your fix edited — `git add -- <paths>`, never `git add -A`, so that build ' +
    'output, logs, generated fixtures or any other artifact the verification step left in the worktree stay out of ' +
    'the commit — and `git commit` with a concise message. You are already on the branch you created in step 0; do ' +
    'not create another one. Do NOT push. Return `{ status: "applied", sha, branch, changedFiles, reason }` — `sha` ' +
    'from `git rev-parse HEAD`, `branch` the name you actually created in step 0 (report it exactly, since it is what ' +
    'gets torn down afterwards), and `changedFiles` listing every repo-relative path you modified, which must match ' +
    'the commit exactly (check with `git show --name-only`). Accurate `changedFiles` is critical: the orchestrator ' +
    'uses it to detect fixes that collide on a shared file.\n' +
    `5. Sanity-check before returning: \`git rev-parse HEAD~1\` must still print \`${reviewHead}\`. If it does not, ` +
    'your commit is not parented on the reviewed commit and cannot be landed — return ' +
    '`{ status: "verify-failed", reason }` explaining what base it ended up on.\n\n' +
    'Return only the structured result.\n\n' +
    surveyBlock(survey) +
    generatedPathsBlock(generatedPaths)
  );
};

const reconcilePrompt = (groupFixes, groupIdx, survey, reviewHead, generatedPaths) => {
  // The union of what the group's fixes touched. The merged commit must stay inside it: the wrapper's cherry-picks are
  // only commutative while every commit's file set is disjoint from every other's, and the groups were made disjoint
  // from each other using exactly these lists. A merged commit that writes a file outside the union — a rebuilt bundle,
  // say — is disjoint from nothing, and in one observed run that is precisely what aborted the landing sequence.
  const inBounds = [...new Set(groupFixes.flatMap((groupFix) => groupFix.changedFiles || []))];

  return (
    'You are a Reconciliation agent in an isolated git worktree. Several independent Fix agents each committed a fix, ' +
    'but their changes touch overlapping files and cannot all be applied as-is. Produce ONE commit that coherently ' +
    'applies ALL of their fixes together.\n\n' +
    'Fixes to combine (inspect each with `git show <sha>`):\n' +
    groupFixes
      .map((f) => `- ${f.sha} (${f.branch}) — files: ${(f.changedFiles || []).join(', ')} — ${f.reason}`)
      .join('\n') +
    '\n\nProcedure:\n' +
    pinToReviewHead(
      reviewHead,
      'rrmerge',
      String(groupIdx),
      'return `{ status: "failed", reason }` naming the SHA you got instead. Do not try to reconcile onto a different ' +
        'base: the result would not be landable.',
    ) +
    "1. Apply each fix in turn (e.g. `git cherry-pick <sha>`), resolving conflicts so every fix's intent is preserved " +
    'and the result is coherent. Some of those commits may themselves be parented on the wrong base, in which case ' +
    'their diffs will conflict — resolve in favour of the code as it exists at the reviewed commit you are pinned to. ' +
    'If two fixes genuinely contradict, prefer the higher-severity intent and note the tradeoff in `reason`.\n' +
    "2. Verify the combined result in this worktree with the survey's build/test tooling. If it cannot be made to " +
    'pass, return `{ status: "failed", reason }`.\n' +
    '3. STAY IN BOUNDS. Your commit may modify only the files the fixes you are merging already touched, listed ' +
    `below. Writing anything else makes the commit un-landable — the orchestrator proved this group disjoint from ` +
    'every other group using exactly this list, and one extra file voids that. Stage explicitly with ' +
    '`git add -- <paths>`, never `git add -A`, and if a verification step rewrote something outside the list, restore ' +
    'it (`git checkout -- <path>`) before committing.\n' +
    `In-bounds files (${inBounds.length}):\n${bulletList(inBounds, '(none reported)')}\n` +
    '4. On success, land the result as a single commit on the branch you created in step 0 and return ' +
    '`{ status: "resolved", sha, branch, changedFiles, reason }` — `branch` exactly as you created it, and ' +
    '`changedFiles` matching `git show --name-only` exactly.\n' +
    `5. Sanity-check before returning: \`git rev-parse HEAD~1\` must still print \`${reviewHead}\` — the merged result ` +
    'must be a single commit directly on the reviewed commit, not a chain. If you produced several commits, squash ' +
    'them into one.\n\nReturn only the structured result.\n\n' +
    surveyBlock(survey) +
    generatedPathsBlock(generatedPaths)
  );
};

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
// fix sharing no file with any other is its own singleton group and passes through untouched. This is only sound for
// fixes whose file list is actually known: a fix reporting an empty list unions with nothing and so looks disjoint from
// everything. The caller drops those before grouping (see `unverifiable` below) rather than trusting them here.
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

  const scopeNote = paths.length
    ? ` A path scope is in effect (${pathList}): examine the whole repository but report only defects that involve ` +
      `${paths.length > 1 ? 'those subtrees' : 'that subtree'}.`
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

// With `--partitions auto`, scale the unit count to how much code is actually in scope. A fixed 4-8 range suits a whole
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
    partitions === 'auto'
      ? `Choose the number of units that best fits the scope, in ${autoUnitTarget(fileCount)}.`
      : `Partition into exactly ${partitions} units.`;

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
  `Config — effort: ${effort}, partitions: ${partitions}, validators: ${validators}, maxRounds: ${maxRounds}, ` +
    `fix: ${fix ? 'on' : 'off'}, reviewers: ${reviewers}, scope: ${paths.join(', ') || 'whole repo'}.`,
);

// Phase 1 — Survey: the repository survey and the CLAUDE.md scan, concurrently (both Haiku, full requested effort).
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

// The commit this review is defined against. Read-only rounds do not need it, but every `--fix` sandbox is pinned to
// it (see `pinToReviewHead`), so it is captured here — from the one agent that ran before any worktree existed — and
// validated as a bare object name, since it is interpolated into the `git` command lines of later prompts.
let reviewHead = isCommitSha(survey.headSha) ? survey.headSha : null;

if (reviewHead) {
  log(`Reviewing at ${reviewHead.slice(0, 10)}.`);
}

// How much code is in scope, used below to scale the `auto` partitions range — a range right-sized for a repository is
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

// Phase 2 — Partition (Sonnet, full requested effort).
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

// Phases 3 & 4 — Review + Dedupe, looped until dry. With `--loop` this body repeats up to `maxRounds` times,
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
  // Round marker on every agent label in the round, keyed on whether looping was asked for rather than on the round
  // number: `round > 1` would label round 1 `dedupe` and round 2 `dedupe:r2`, so within one looped run the same agent
  // appears under two naming schemes and round 1 reads as "the un-rounded one". A single pass keeps bare labels —
  // there is only ever one round to name, and label is part of the resume cache key.
  const suffix = loopEnabled ? `:r${round}` : '';

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
  // A stalled agent *throws*; it does not resolve to `null`. Because this call is a bare `await` rather than one arm of
  // a `parallel()`, an unguarded throw propagates out of the script and fails the whole workflow — which is how a
  // 155-finding round that was 42/43 agents done got discarded entirely, and which makes the `gaps` fallback below dead
  // code for the one failure mode most likely to reach it. So catch, and step the effort down before giving up.
  let dd = null;

  for (const dedupeEffort of dedupeEfforts) {
    try {
      dd = await agent(dedupePrompt(union), {
        // The fallback rungs name their effort so a step-down is visible in `/workflows` rather than silent.
        label: `dedupe${suffix}${dedupeEffort === dedupeEfforts[0] ? '' : `:${dedupeEffort}`}`,
        phase: 'Dedupe',
        model: 'opus',
        effort: dedupeEffort,
        schema: DEDUPE_SCHEMA,
      });
    } catch (err) {
      log(`Dedupe round ${round} stalled at effort ${dedupeEffort}: ${err?.message || err}`);
      dd = null;
    }

    if (dd?.groups) break;
  }

  // `groups: []` is a real answer — "nothing collided" — so test for the key, not its truthiness.
  if (dd?.groups) {
    deduped = mergeIssueGroups(union, dd.groups);
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

// Phase 5 — Validate (barrier). Per issue, run `--validators` independent validators; keep on a strict majority of those
// that return. High-risk categories validate with Opus, the rest with Sonnet; both at capped leaf effort.
phase('Validate');
const HIGH_RISK = ['architecture', 'bug', 'consistency', 'security'];
const isHighRisk = (issue) => HIGH_RISK.includes(issue.category);

// --- Agent labels for the per-finding phases -----------------------------------------------------------------------
// One handle per finding, shared by every agent that touches it — validator, fixer, reviser, fix reviewer — so a single
// finding can be followed across phases in the progress tree. The number is the same index the fixer's branch uses
// (`rrfix/<RUN>/<n>`), so a label points at its branch without arithmetic.
const findingTag = (issue, idx) => `${issue.category}#${idx}`;

// Name a member of a redundant group only when the group has more than one member. `vote 1/1` is noise, and under the
// default `--validators 1` / `--reviewers 1` every label would carry it — which is how `validate:bug:3:0` came to end in a
// constant `:0` that looked like it meant something.
const voteTag = (k, count) => (count > 1 ? ` vote ${k + 1}/${count}` : '');

// Attempt 0 is the original fix; only the revisions need saying, counted from 1 as attempts rather than from 0.
const attemptTag = (attempt) => (attempt > 0 ? ` attempt ${attempt + 1}` : '');

// With `--validators auto`, high-risk categories get 3 independent validators and the rest get 1; an explicit count
// applies uniformly. `validators` was normalized to 'auto' or a positive integer at the top, so no parsing here.
const validatorCount = (issue) =>
  validators === 'auto' ? (isHighRisk(issue) ? 3 : 1) : validators;

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

// Phases 6 & 7 — Fix, then Fix review, per finding and concurrent. Each validated finding runs its own pipeline: a
// worktree-isolated Fix agent edits, verifies in its sandbox, and commits only a clear, safe, localized change (Opus
// for high-risk categories, Sonnet otherwise, at capped leaf effort). Then, unless `--reviewers 0` disabled it,
// `reviewers` read-only reviewers judge the commit for correctness and quality and approve on a strict majority. A
// rejected fix is handed back to a fresh Fix agent — given the rejected diff and the objection — up to
// `FIX_REVISION_CAP` times, re-reviewing each attempt. Only an approved commit reaches Reconcile; declined,
// verify-failed, and review-rejected findings are reported unfixed. Findings are independent until Reconcile, so the
// whole fix→review→revise loop runs concurrently across them; isolation keeps their parallel edits from colliding.
phase('Fix');

// Every sandbox below is pinned to `reviewHead`, so without it there is nothing to pin to and no way to check that a
// returned commit is landable. The surveyor is a Haiku agent answering a long structured question, so it does
// occasionally drop the field; re-ask for just that one value rather than throwing the whole `--fix` run away.
if (!reviewHead) {
  const headOnly = await agent(
    'Run `git rev-parse HEAD` in the repository root and return its full 40-character output as `headSha`. Return ' +
      'nothing else — do not abbreviate it, and do not substitute a branch name.',
    {
      label: 'review-head',
      phase: 'Fix',
      model: 'haiku',
      effort: 'low',
      schema: { type: 'object', properties: { headSha: { type: 'string' } }, required: ['headSha'] },
    },
  );

  reviewHead = isCommitSha(headOnly?.headSha) ? headOnly.headSha : null;
}

// Refusing to fix is the honest outcome here. A sandbox left unpinned is checked out at the *remote* default branch,
// which has been observed 126 commits behind the reviewed tree — the fixers would edit stale source and return commits
// on scattered bases that the wrapper is told are conflict-free. Reporting the findings unfixed costs the fix phase;
// running it unpinned costs the trustworthiness of the whole result.
if (!reviewHead) {
  gaps.push(
    'The reviewed commit SHA could not be determined, so the Fix phase did **not** run: a fix sandbox is created at ' +
      'the remote default branch rather than local `HEAD`, and without the SHA it cannot be pinned to the code that ' +
      'was actually reviewed. These findings are **not** fixed and are **not** verified as unfixable. Re-run `--fix`.',
  );

  return { findings, exclusions, gaps };
}

// Generated/build-output paths, named to the fixers so they do not stage a rebuilt artifact, and used below to refuse a
// commit that did anyway. Derived from the partitioner's own exclusion reasons — it already had to identify generated
// code to leave it out of the review, so this reuses that judgement instead of hardcoding a path list.
const GENERATED_REASON = /generat|build output|bundl|compil|transpil|minif|artifact|\bdist\b|vendor|lock ?file/i;
const generatedPaths = [
  ...new Set(exclusions.filter((e) => GENERATED_REASON.test(e.reason || '')).map((e) => e.path).filter(Boolean)),
];

// A changed file is a generated artifact when it is one of those paths or sits beneath one of them.
const isGeneratedPath = (file) =>
  generatedPaths.some((p) => file === p || file.startsWith(p.endsWith('/') ? p : `${p}/`));

if (generatedPaths.length) {
  log(`Fixers told to leave ${generatedPaths.length} generated path(s) unstaged.`);
}

// Every sandbox branch any fixer reported creating, successful or not. Teardown works off this rather than off the
// per-finding outcomes, because a finding that went through two revisions created three branches and its outcome names
// only the last — and a declined fixer created one and committed nothing at all.
const createdBranches = [];

// Run a Fix agent: attempt 0 is the initial fix (Fix phase); later attempts are revisions (Review Fix phase) that see
// the prior rejected commit and the objection. Each attempt commits on its own branch so branch names never collide.
const runFixer = async (issue, idx, attempt, revisionCtx) => {
  // Only the suffix is fixed here. The `rrfix/<RUN>/` prefix is composed by the agent from its own sandbox branch name
  // (see `pinToReviewHead`), because that is the only place this run's identity is legible — the script has no git
  // access and no handle on the workflow id. Whatever name it reports comes back on `branch` and is what gets deleted.
  const suffix = attempt === 0 ? `${idx}` : `${idx}-r${attempt}`;
  const tag = findingTag(issue, idx);

  const result = await agent(fixerPrompt(issue, survey, reviewHead, suffix, generatedPaths, revisionCtx), {
    label: attempt === 0 ? `fix:${tag}` : `revise:${tag}${attemptTag(attempt)}`,
    phase: attempt === 0 ? 'Fix' : 'Review Fix',
    model: isHighRisk(issue) ? 'opus' : 'sonnet',
    effort: leafEffort,
    isolation: 'worktree',
    schema: FIX_RESULT_SCHEMA,
  });

  // Record the branch before judging the fix: it exists either way, and an unrecorded branch is an unremovable one.
  if (isSafeBranchName(result?.branch)) {
    createdBranches.push(result.branch);
  }

  // An 'applied' fix without a usable commit reference cannot be reviewed or cherry-picked, and its reference must not
  // reach a command line, so drop the reference and report the finding unfixed.
  if (result?.status === 'applied' && !(isCommitSha(result.sha) && isSafeBranchName(result.branch))) {
    return {
      ...result,
      status: 'verify-failed',
      sha: '',
      branch: '',
      reason: 'fix agent reported `applied` without a usable commit SHA / branch, so the fix was discarded',
    };
  }

  return result;
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

// `sha` is optional in the fix schema, so a fixer can claim `applied` and return no commit. There is nothing to
// cherry-pick in that case, so the finding is unfixed — but `applied` is one of the two statuses the wrapper reports
// as fixed, and the commit list below drops SHA-less fixes, so passing the status through would report a fix that does
// not exist. Downgrade it to `verify-failed` (the change never survived to a commit) and name the gap.
const asOutcome = (issue, result) => {
  if (result.status === 'applied' && !result.sha) {
    gaps.push(
      `Fix agent reported an applied fix with no commit for a ${issue.category} finding: ${issue.description.slice(0, 80)}`,
    );

    return {
      issue,
      status: 'verify-failed',
      changedFiles: result.changedFiles || [],
      reason: `fix reported as applied but returned no commit SHA${result.reason ? `: ${result.reason}` : ''}`,
    };
  }

  return {
    issue,
    status: result.status,
    sha: result.sha,
    branch: result.branch,
    changedFiles: result.changedFiles || [],
    reason: result.reason,
  };
};

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
      // `branch` is carried through on the rejections too: the commit still exists, and naming the branch it sits on is
      // what lets the user go and look at a fix the reviewers threw out before the sandboxes are torn down.
      return {
        issue,
        status: 'review-rejected',
        reason: review.objection,
        branch: current.branch,
        changedFiles: current.changedFiles || [],
      };
    }

    // Out of revision attempts: the fix stays rejected and unfixed.
    if (rev === FIX_REVISION_CAP) {
      return {
        issue,
        status: 'review-rejected',
        reason: review.objection || 'fix rejected by review',
        branch: current.branch,
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

const committed = outcomes.filter((outcome) => outcome.status === 'applied' && outcome.sha);

// An `applied` fix that reports no changed files is not disjoint from the others — its file set is *unknown*. It
// committed something, `changedFiles` is self-reported (the schema cannot make it accurate, and this script has no git
// access to re-derive it), and `groupByFileCollision` keys collisions solely on those lists: an empty one unions with
// nothing, so the fix becomes its own singleton group and its commit goes straight into `commits`. If it did touch a
// file another landed fix touched, the wrapper — told the list is conflict-free by construction — hits an unexpected
// cherry-pick conflict, aborts, and stops, leaving a half-landed fix branch while the skipped findings still read as
// `applied`. Such a commit can still land when it is the only one (nothing else is picked, so nothing can conflict with
// it); alongside others it cannot, so drop it and report the finding honestly as unfixed.
const unverifiable = committed.length > 1 ? committed.filter((outcome) => !outcome.changedFiles?.length) : [];
unverifiable.forEach((outcome) => {
  outcome.reason =
    `the fix committed ${outcome.sha} but reported no changed files, so it could not be checked for collisions with ` +
    `the other ${committed.length - 1} applied fix(es) and was not landed. Fixer's note: ${outcome.reason}`;
  outcome.status = 'conflict-skipped';
  outcome.sha = undefined;
});

if (unverifiable.length) {
  gaps.push(
    `${unverifiable.length} applied fix(es) reported no changed files, so they could not be proven conflict-free ` +
      'against the other fixes and were left unlanded — those findings are **not** fixed and are **not** verified as ' +
      'unfixable.',
  );
}

// A fix that committed a regenerated build artifact cannot be landed alongside others. Every fix that rebuilds the same
// bundle writes the same path, so union-find collapses all of them into one reconciliation group — in one observed run
// four such fixes pulled 30 findings into a single merged commit that then overlapped three unrelated commits and
// aborted the landing sequence. The script cannot rewrite a commit to drop the artifact (it has no git access), so the
// artifact has to be kept out by the fixer; when one slips through anyway, refuse the commit rather than let it poison
// the grouping. As with `unverifiable`, a lone commit is harmless — there is nothing else for it to collide with.
const artifactTainted =
  committed.length > 1
    ? committed.filter(
        (outcome) => outcome.status === 'applied' && (outcome.changedFiles || []).some(isGeneratedPath),
      )
    : [];
artifactTainted.forEach((outcome) => {
  const offending = (outcome.changedFiles || []).filter(isGeneratedPath).join(', ');
  outcome.reason =
    `the fix committed ${outcome.sha} but staged generated build output (${offending}), which every other fix that ` +
    `rebuilt the same artifact also writes — so it could not be landed as a disjoint change. Fixer's note: ` +
    `${outcome.reason}`;
  outcome.status = 'conflict-skipped';
  outcome.sha = undefined;
});

if (artifactTainted.length) {
  gaps.push(
    `${artifactTainted.length} applied fix(es) committed generated build output despite being told not to, so they ` +
      'could not be proven disjoint from the other fixes and were left unlanded — those findings are **not** fixed ' +
      'and are **not** verified as unfixable.',
  );
}

const applied = committed.filter((outcome) => outcome.status === 'applied');
log(
  `Fix/Review: ${applied.length} approved, ${outcomes.length - applied.length} unfixed ` +
    '(declined / verify-failed / review-rejected / conflict-skipped).',
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
        branch: only.branch,
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
      rr = await agent(reconcilePrompt(groupFixes, gi, survey, reviewHead, generatedPaths), {
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

    // Recorded for teardown before the result is judged, exactly as for a fixer's branch.
    if (isSafeBranchName(rr?.branch)) {
      createdBranches.push(rr.branch);
    }

    // As with a fix result, a merged commit whose `sha` is not a bare hex object name cannot be cherry-picked and must
    // not be interpolated into a `git` command, so it counts as a failed reconciliation.
    if (rr?.status === 'resolved' && !isCommitSha(rr.sha)) {
      rr = { ...rr, status: 'failed', reason: 'reconciliation reported no usable commit SHA' };
    }

    // The groups were proven disjoint from one another using the *fixers'* file lists, so a merged commit that writes
    // anything outside its group's union is disjoint from nothing and voids the guarantee the wrapper relies on. This is
    // the second premise that broke in the observed run: a 30-finding merge commit touched 25 files, including a rebuilt
    // bundle, and overlapped three commits later in the sequence. Treat straying as a failed reconciliation — the
    // alternative is handing the wrapper a commit it will abort on after already landing others.
    if (rr?.status === 'resolved') {
      const inBounds = new Set(groupFixes.flatMap((groupFix) => groupFix.changedFiles || []));
      const strayed = (rr.changedFiles || []).filter((file) => !inBounds.has(file));

      if (strayed.length) {
        rr = {
          ...rr,
          status: 'failed',
          reason:
            `the merged commit modified ${strayed.join(', ')}, outside the files its fixes touched, so it could not ` +
            `be proven disjoint from the other commits. Reconciler's note: ${rr.reason}`,
        };
      }
    }

    if (rr?.status === 'resolved' && rr.sha) {
      return {
        sha: rr.sha,
        branch: rr.branch,
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

const candidateCommits = reconciled.filter(Boolean);

// Last gate before the wrapper. Everything above *should* have produced commits with pairwise-disjoint file sets, but
// every step of that reasoning runs on self-reported file lists from agents this script cannot audit, and the wrapper is
// told the list is conflict-free "by construction" — so it cherry-picks without expecting a conflict and, when one
// comes, has already half-landed the branch. Check the property here instead of asserting it: walk the commits in order,
// keep each one whose files are still unclaimed, and drop any that overlaps a commit already kept. Dropping is the
// conservative direction — a skipped fix is reported honestly as unfixed, whereas an overlapping one aborts the landing
// and strands every commit behind it.
const claimedFiles = new Map();
const commits = [];

candidateCommits.forEach((commit) => {
  const overlap = (commit.changedFiles || []).filter((file) => claimedFiles.has(file));

  if (overlap.length) {
    const blocking = [...new Set(overlap.map((file) => claimedFiles.get(file)))].join(', ');
    commit.findings.forEach((issue) => {
      const outcome = outcomes.find((x) => x.issue === issue);

      if (outcome) {
        outcome.status = 'conflict-skipped';
        outcome.reason =
          `the fix committed ${commit.sha} but it overlaps an already-landed commit on ${overlap.join(', ')} ` +
          `(also written by ${blocking}), so it could not be landed without a conflict`;
        outcome.sha = undefined;
      }
    });

    gaps.push(
      `A commit was dropped for overlapping ${overlap.join(', ')} with commit ${blocking} — the fix pipeline is ` +
        'supposed to make these disjoint, so this is a defect in the run, not merely an unfixable finding. ' +
        `${commit.findings.length} finding(s) are **not** fixed and **not** verified as unfixable.`,
    );
    return;
  }

  (commit.changedFiles || []).forEach((file) => claimedFiles.set(file, commit.sha));
  commits.push(commit);
});

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

// Every branch this run created, so the wrapper can tear down exactly what it made. Globbing `rrfix/*` was the previous
// approach and it is wrong in both directions: it would delete a *concurrent* run's sandboxes, and it depends on a
// naming convention the agents are only asked, not forced, to follow. These names are what the agents reported creating.
const sandboxBranches = [...new Set(createdBranches)];

// The wrapper creates the fix branch off HEAD and cherry-picks `commits` in order. `base` is the commit every one of
// them should be parented on and `changedFiles` are pairwise disjoint, which together are what make the picks
// commutative — the wrapper re-checks both against git before landing anything, because this script has no git access
// and can only take the agents' word for it. `outcomes` carries the per-finding result for the report.
return {
  findings,
  exclusions,
  gaps,
  fix: {
    base: reviewHead,
    sandboxBranches,
    commits: commits.map((commit) => ({
      sha: commit.sha,
      branch: commit.branch,
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
      branch: outcome.branch,
      reason: outcome.reason,
    })),
  },
};
