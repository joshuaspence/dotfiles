/**
 * This script is the committed orchestration for the `/repo-review` command. The command (a thin prose wrapper) parses
 * arguments, runs this workflow via the `Workflow` tool, and formats what it returns. All I/O — GitHub permalinks
 * (which need `git`) and writing `--output` — is the wrapper's job, because workflow scripts have no filesystem or git
 * access.
 *
 * Inputs arrive on `args` as `{ paths, effort, partitions, validators, round, knownFindings }`, normalized through
 * `normalizeArgs` below because this call site delivers that object JSON-encoded as a string. The return value is
 * `{ reviewedCommit, round, findings, newFindings, exclusions, gaps }`. `reviewedCommit` is on every exit, including the
 * aborts: it is the commit the whole review is defined against, so the wrapper cites it rather than re-deriving a `HEAD`
 * that may have moved since.
 *
 * **Read-only, throughout.** Nothing here writes to the repository and no phase runs in an isolated worktree, which is
 * why the guard against a stray build or install appears in every prompt below rather than in some of them. Fixing what
 * this finds is `/repo-review-fix`, a separate command driven by the ledger the wrapper persists from this return value.
 * The two used to be one workflow behind a `--fix` flag, and the coupling ran the wrong way: a fix could only be
 * attempted at the tail of a review, so re-fixing meant re-reviewing, and a single session limit took out both.
 *
 * **One round per invocation.** The multi-round `--loop` used to live here as a `for` loop around Review+Dedupe, and it
 * is why the run this design replaces produced nothing at all: Review and Validate are `parallel()` barriers, so a run
 * killed in round 3 — by a session limit, a stall, or the user — discarded rounds 1 and 2 along with it. Rounds are now
 * the *caller's* loop. Each invocation is one complete review that returns, gets reported and gets persisted, and the
 * wrapper decides whether to run another: it re-invokes with `round` incremented and `knownFindings` set to what came
 * back, which is what steers the new round past what the last one already found (`emphasisBlock`,
 * `knownFindingsBlock`). `newFindings` is the count that decides it — the round went dry when that reaches zero.
 *
 * Every finding in `findings` carries a `fingerprint`, a content-addressed name for the defect (see `fingerprint`).
 * Nothing in this script keys on it: it exists for the two things that outlive one invocation — the ledger the wrapper
 * persists between them, and the trailer each `/repo-review-fix` commit carries — and it is what lets the wrapper tell
 * what a round contributed from what it handed over without diffing free prose.
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

// --- Argument normalization ---------------------------------------------------------------------------------------
// `args` is meant to arrive as an object, but in practice this call site delivers a JSON-encoded *string*: four
// consecutive launches did so, including one where the caller knew about the defect, was actively trying to avoid it,
// and had just re-read this very code. Neither trusting the shape nor refusing it works. Trusting it is silent and
// expensive — no `args?.foo` lookup on a string can succeed, so every knob below falls back to its default, widening a
// scoped review to the whole repository and losing the ledger that steers it past what is already known, with only the
// `Config —` line to give it away. Refusing it outright is worse: it fails every invocation. So recover the object
// here, where the check is deterministic, while leaving the object form as what the caller should still send.
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
    // Explicitly null, not absent: `reviewedCommit` is on every exit, and null is the documented signal for "the
    // script never learned it, fall back to `git rev-parse HEAD`". This abort is before the survey, so it never could.
    reviewedCommit: null,
    round: 1,
    findings: [],
    newFindings: 0,
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
// agents enumerate with. Each path is single-quoted in the pathspec — with several of them, an unquoted path containing
// a space would split into two pathspecs and widen the scope rather than fail. Quoting alone is not escaping, though,
// and this command is not merely logged: it is handed to the survey and partition agents as a command to run, so an
// apostrophe in a path would close the quote and leave the rest of the path to be parsed as shell syntax. `shellQuote`
// closes the quote, escapes the apostrophe, and reopens it, the standard POSIX single-quote escape.
const shellQuote = (p) => `'${p.replace(/'/g, "'\\''")}'`;
const pathList = paths.map((p) => `\`${p}\``).join(', ');
const scope =
  paths.length === 0 ? 'the whole repository'
  : paths.length === 1 ? `the subtree ${pathList}`
  : `the subtrees ${pathList}`;
const lsFiles = paths.length ? `git ls-files -- ${paths.map(shellQuote).join(' ')}` : 'git ls-files';

// Whether a repo-relative path lies within a subtree — the containment relation the pathspec above expresses to `git`,
// and the one `fileInUnit` uses to place a finding in a unit. `p` alone is not a prefix test: `src` must not swallow
// `srcgen/a.js`.
const underPath = (file, p) => file === p || file.startsWith(p.endsWith('/') ? p : `${p}/`);

// The scope, enforced rather than merely described. Everything above this point is prose bound for a prompt, but the
// paths the later phases actually read and review are the ones the *Partition agent* returned:
// `unit.paths` is the reviewers' file list, the count the architecture-lens gate keys on, and the relation that scopes
// known findings and dedupe. So a partitioner that widens past the requested subtrees — or that ignores `lsFiles` and
// enumerates the repository — silently redefines the review's scope, and no later phase can tell. Hence intersect the
// agent's answer with the caller's: two subtrees overlap in the narrower of the pair, and in nothing at all when
// neither contains the other. A unit path that *contains* a requested one is not out of scope but too wide, so it
// narrows to the requested subtrees it covers rather than being dropped, which would lose their coverage entirely.
const narrowToScope = (unitPaths) => {
  // A non-string or blank entry would throw inside `underPath` and take the whole run down; it is dropped here for the
  // same reason `normalizePaths` drops one on the way in. Sanitised *before* the unscoped early return below, not
  // after: with no `--paths` there is no intersection to take, but `unit.paths` still reaches `underPath` through
  // `fileInUnit` when the Dedupe phase buckets findings, and that call sits outside any `try`, so one `null` in a
  // whole-repository partition would throw away the whole Review phase that had just finished. Trimming matters there
  // too — a padded `' src'` matches no file at all, silently mis-scoping that unit's findings.
  const list = (unitPaths || []).filter((p) => typeof p === 'string' && p.trim() !== '').map((p) => p.trim());

  if (!paths.length) return [...new Set(list)];

  return [
    ...new Set(
      list.flatMap((p) => (paths.some((s) => underPath(p, s)) ? [p] : paths.filter((s) => underPath(s, p)))),
    ),
  ];
};


// --- Finding identity ------------------------------------------------------------------------------------------------
// A finding's fingerprint: the stable name the two things that outlive a run are keyed by — the ledger the wrapper
// persists between invocations, and the `Repo-Review-Finding:` trailer on a fix commit, which is what makes a
// `/repo-review-fix` run killed before it returned recoverable from `git log --all --grep` with no state file at all.
// Array indices remain the *in-run* wire format (the dedupe agent returns indices and `mergeIssueGroups` does the
// copying), and nothing here changes that: this is a persistence format, declared this high only because its first
// consumer is `knownFindings` two sections down.
//
// It *names* a finding; it does not *match* one. Two reviewers describing the same defect in different words get
// different fingerprints, and deciding that they are the same defect is the dedupe agent's job and always will be — a
// hash cannot read code. What it buys is that a finding surviving the round trip through the wrapper's JSON comes back
// recognisable, so the wrapper can tell what a round contributed from what it handed over (the fingerprints in
// `findings` that are not in the `knownFindings` it sent, whose count must equal `newFindings`), and can carry
// per-entry ledger metadata — when a finding was first seen, and at which commit — across a list whose order and length
// change every round.
//
// Three fields, chosen as much for what they leave out as for what they include:
//   `category`  — the reviewer's own key, stamped by the script rather than chosen by the agent.
//   `file`      — the primary site, without `lines`. An edit above a defect moves it without changing it, and an
//                 identity that moved with it would report the same defect as new in every later round.
//   description — with every digit dropped, for that same reason: descriptions quote line numbers, counts and offsets.
// `severity` is left out because a finding re-reported as `high` rather than `medium` is the same defect differently
// judged, and `otherSites` because `mergeIssueGroups` *appends* to it when a duplicate is absorbed — including it would
// change a survivor's identity at the moment it absorbed one, which is precisely when it must not.
//
// Digits are dropped rather than replaced by a placeholder, so "the retry loop runs 3 times" and "the retry loop runs 5
// times" are one finding — the intended reading, since they are one defect described against two versions of the code.
// The cost is that two genuinely distinct defects differing *only* in a number, in one file, under one category, are
// treated as one. Everything that is not a letter collapses to a single space, so `parse_frame` and `parse frame` agree
// and no punctuation choice is load-bearing; `\p{L}` rather than `a-z` so a description not written in English keeps its
// letters instead of normalising to nothing, which would make every finding in one file and category identical.
const fingerprintKey = (issue) =>
  [
    String(issue?.category ?? '')
      .toLowerCase()
      .trim(),

    // Not lowercased: paths are case-sensitive on the filesystems this runs against, so `Core/Wire.py` and
    // `core/wire.py` are two files and must not become one finding.
    String(issue?.file ?? '')
      .trim()
      .replace(/^\.\//, ''),
    String(issue?.description ?? '')
      .toLowerCase()
      .replace(/[^\p{L}]+/gu, ' ')
      .trim(),

    // Joined on NUL, not a space: a space is a character two of the three fields can contain, so a file named
    // `a b` with the description `c` and a file named `a` with the description `b c` would concatenate to one key.
    // NUL is the one byte a POSIX path cannot hold, and the description is normalised down to letters and spaces,
    // so neither field can forge the separator.
  ].join('\u0000');

// FNV-1a and djb2, concatenated to 16 hex characters. Neither is cryptographic and neither needs to be — a repository
// that could forge a collision would only suppress its own second finding, and would have to control both descriptions
// to the letter. What the pair buys is width. A single 32-bit hash collides with even odds at ~77k findings and at
// roughly one in ten thousand for a few hundred of them, and a collision here is not a wrong number in a report: two
// distinct defects become one ledger entry and the second is suppressed for good. Two structurally different mixes
// (multiply-xor and multiply-add) are uncorrelated enough in practice to put that out of reach, and the second
// accumulator costs one more expression inside a loop that already runs.
//
// `Math.imul` rather than `*`, because JavaScript numbers are doubles: a 32-bit multiply overflows into the mantissa and
// silently loses the low bits a hash's avalanche depends on. `>>> 0` renders each accumulator back as unsigned.
const fingerprint = (issue) => {
  const key = fingerprintKey(issue);
  let fnv = 0x811c9dc5;
  let djb = 5381;

  for (let i = 0; i < key.length; i++) {
    const code = key.charCodeAt(i);

    fnv = Math.imul(fnv ^ code, 0x01000193);
    djb = (Math.imul(djb, 33) + code) >>> 0;
  }

  return (fnv >>> 0).toString(16).padStart(8, '0') + djb.toString(16).padStart(8, '0');
};

// Stamped on every finding the run touches, so that the value a fixer is told to write into its commit trailer and the
// value the wrapper persists are the same one by construction rather than by two call sites agreeing. Recomputed on the
// findings the wrapper hands back rather than trusting the stored value: it is idempotent, and an entry whose ledger
// copy was hand-edited — or that predates this format — would otherwise come back unrecognisable to itself and be
// counted as newly found.
const withFingerprint = (issue) => ({ ...issue, fingerprint: fingerprint(issue) });


// --- Configuration knobs ------------------------------------------------------------------------------------------
// Each knob tolerates missing or malformed input. `partitions` (review units) and `validators` (validators per finding)
// accept the sentinel 'auto' or a positive integer. `effort` must be a known level or absent (defaults to 'high').
const EFFORT_ORDER = ['low', 'medium', 'high', 'xhigh', 'max'];
const effort = input?.effort
  ? EFFORT_ORDER.includes(input.effort)
    ? input.effort
    : (() => {
        return {
          findings: [],
          exclusions: [],
          round: 1,
          newFindings: 0,
          gaps: [
            `\`--effort\` must be one of ${EFFORT_ORDER.join(', ')} but received '${input.effort}'. ` +
              'Review aborted — re-run with a valid effort level.',
          ],
        };
      })()
  : 'high';

// Early return if effort validation failed
if (typeof effort === 'object' && effort.gaps) {
  return effort;
}

function positiveIntOr(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isNaN(n) || n < 1 ? fallback : n;
}

const partitions = input?.partitions === 'auto' ? 'auto' : positiveIntOr(input?.partitions, 'auto');
const validators = input?.validators === 'auto' ? 'auto' : positiveIntOr(input?.validators, 1);

// Which round this invocation is. It is not a cap and it multiplies nothing: the round drives only how the reviewers are
// steered (`emphasisBlock`), because the *caller* owns the loop now. A missing, zero, negative or non-numeric value is
// round 1, the baseline pass, whose prompts are byte-identical to a single-pass run — so an unreadable round number
// costs a run its steering and never its correctness.
const round = positiveIntOr(input?.round, 1);

// What earlier rounds already found, as the wrapper hands it back. Two things key on it and both are about not paying
// twice: the reviewers are shown it so they look elsewhere, and dedupe merges this round's raw findings *against* it so
// a re-report is absorbed rather than reported again. It is also why round 2 need not re-validate — see `NEW_THIS_ROUND`.
//
// Sanitised rather than trusted, because it makes a full round trip through the wrapper's JSON and back: a non-object
// entry would reach `issueSite`, `fileInUnit` and the dedupe digest, and the first of those throws. An entry with no
// `category` is kept — `knownLine` renders it as `[undefined]`, which is ugly but is still a finding worth suppressing.
// Fingerprinted on the way in rather than on the way out, so that every finding in the run carries one from its first
// line to its last: the value the wrapper stores is then the same one a fixer was told to write into its commit trailer,
// and `findings` carries one on every exit including the aborts.
const knownFindings = (Array.isArray(input?.knownFindings) ? input.knownFindings : [])
  .filter((issue) => issue && typeof issue === 'object')
  .map(withFingerprint);


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
// 180s, and a dedupe agent has no tools to call, so it streams nothing at all until its first token — there is no
// progress to report while it thinks. A 155-finding round at `max` hit that watchdog on all six attempts (`agent
// stalled on all 6 attempts (no progress for 180000ms each)`), while a reviewer in the same run spent 296s on a
// 32k-character thinking block and was fine, because its tool calls kept reporting progress. The same prompt at `high`
// reached its first token in 107s. So start at `high` and step down on a stall, never exceeding what was requested:
// under the indices-only contract this is shallow judgement ("is finding i the same defect as finding j?"), so the
// lower rung costs little.
//
// The ladder is only half the defence, and the cheaper half. It buys one rung; think time keeps growing with the number
// of findings handed over, so a big enough round exhausts both rungs. `DEDUPE_CHUNK_CAP` below bounds that input
// instead — at both dedupe stages, since a partition into units bounds nothing on its own.
const DEDUPE_EFFORT_LADDER = ['high', 'medium'];
const dedupeEfforts = [...new Set(DEDUPE_EFFORT_LADDER.map((e) => capEffort(e, effort)))];

// How large a digest each rung has been observed to answer for. Exhausting a rung is not free: six attempts at 180s is
// 18 minutes of wall clock spent discovering what `issues.length` already predicted, and the run looks hung for all of
// it. So a rung whose ceiling the digest clears is skipped rather than tried. Measured on Opus, `high` answered 116
// findings in 96s and 163 in ~2 minutes, and was killed on all six attempts at both 209 and 253; `medium` answered 209
// in 140s and 253 in ~150s. The ceiling goes between the largest digest that worked and the smallest that did not,
// which is four measurements holding up one number — so it is a schedule, not a guarantee, and the ladder below still
// catches a rung that stalls under its own ceiling.
const DEDUPE_RUNG_CEILING = { high: 180 };

// The rungs worth trying for a digest of `count` findings, in ladder order. Never empty: when every ceiling is exceeded
// the lowest rung is still tried, because stalling there costs time whereas refusing to try costs the merge outright.
const dedupeRungs = (count) => {
  const viable = dedupeEfforts.filter((rung) => count <= (DEDUPE_RUNG_CEILING[rung] ?? Infinity));

  return viable.length ? viable : dedupeEfforts.slice(-1);
};


// --- Finding categories and the reviewers that produce them ------------------------------------------------------
// A finding's category is the reviewer that reported it, so these two rosters are the only place the set of categories
// is written down. Both of the enumerations that follow from it are derived: `CATEGORIES` (the `ISSUE` schema's enum,
// below) and `HIGH_RISK` (which validation path a finding takes, declared with the dedupe merge that has to preserve
// it). That is why the rosters sit ahead of the schemas rather than beside the prompts that render them — a hand-listed
// copy of this set drifts the moment a reviewer is added or renamed, and drifts silently: the schema stops accepting
// the new category's findings, and the validator quietly puts them on the cheap path.

// --- Per-unit reviewers (Agents 1-6) -----------------------------------------------------------------------------
// `highRisk` marks the categories the Validate phase checks the hard way — Opus, and three voters under
// `--validators auto`. It is deliberately not the reviewer's own `model`: `consistency` defects are cheap to find
// and expensive to get wrong, so a Sonnet reviewer reports them and an Opus validator confirms them.
//
// This roster is also what a clean run claims it checked: the wrapper's "No issues found" sentence in
// `exact_commands/repo-review.md` enumerates these categories plus architecture. Adding or removing a reviewer here
// without updating that sentence makes the report understate (or overstate) what was actually reviewed.
const REVIEWERS = [
  {
    key: 'bug',
    model: 'opus',
    highRisk: true,
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
    highRisk: true,
    title: 'Consistency',
    instruction:
      "Look for problems only visible with the whole repository in view: callers that disagree with a function's " +
      'current contract, duplicated logic that has diverged, dead code that is still exported, and configuration that ' +
      'contradicts the code that reads it. Cross-reference against the other units, not just this one.',
  },
  {
    key: 'security',
    model: 'opus',
    highRisk: true,
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
// All three lenses report under one category — a finding names what was looked for, not which lens looked — so the
// category is named here rather than taken from a lens `key`, and the two derivations read it from here.
const ARCHITECTURE_CATEGORY = 'architecture';

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

// Every category a finding can carry: the whole-repo lenses' one, then the per-unit reviewers' keys in roster order.
const CATEGORIES = [ARCHITECTURE_CATEGORY, ...REVIEWERS.map((reviewer) => reviewer.key)];


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

      // Derived from the rosters above, not listed again: a reviewer's key *is* the category it reports under.
      enum: CATEGORIES,
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
    // The exact commit the review reads. Everything `/repo-review-fix` does is defined relative to it, and nothing
    // downstream can discover it for itself: a fix sandbox is NOT checked out here (see `reviewHead` below), so
    // `git rev-parse HEAD` inside one answers a different question. This is the only place it can come from.
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
          reason: { type: 'string', description: 'Why it was left out, for a human reader' },
          // Asked for as a flag rather than read back out of `reason`, because it travels: it is returned to the
          // wrapper, persisted in the ledger, and read by `/repo-review-fix`, which tells its fixers never to stage
          // these paths. `reason` is free prose against no agreed vocabulary, so classifying by matching it made
          // "produced by `npm run build`, not source" read as hand-written source.
          generated: {
            type: 'boolean',
            description:
              'True when tooling produces this path rather than a human writing it — build output, bundles, ' +
              'compiled/transpiled/minified output, lock files, installed or vendored dependencies. False when it is ' +
              'excluded for any other reason (binary assets, fixtures, anything hand-written).',
          },
        },
        required: ['path', 'reason', 'generated'],
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


// --- The reviewed commit ---------------------------------------------------------------------------------------------
// `headSha` is a model-supplied string that reaches a `git` command line: the wrapper builds permalinks from it, and
// `/repo-review-fix` pins every fix sandbox to it and has its sandboxes verify the pin by string comparison. The agent
// that read it read the repository under review, so it is untrusted input — a value of `HEAD; <command>` reads to the
// next reader as an instruction to run `<command>`. Accept only a bare 40-character hex object name. Not 7-to-40: an
// abbreviated name pins a branch correctly and can then never satisfy the `git rev-parse HEAD` string comparison the
// fix command's sandboxes verify their pin with, so every fixer would decline at step 0. Canonicalise to the lower case
// `git rev-parse` prints, so a differently-cased answer is not a permanent mismatch either. Returns the normalised SHA,
// or `null` when it is not one.
const fullCommitSha = (value) =>
  typeof value === 'string' && /^[0-9a-fA-F]{40}$/.test(value) ? value.toLowerCase() : null;


// --- Shared prompt fragments -------------------------------------------------------------------------------------
// Render a list of paths/sites as markdown bullets, falling back to `empty` when there is nothing to list. Each item is
// flattened to one line first, for the same reason `issueSite` below is: a bullet list is one item per line, so an item
// carrying a newline forges extra bullets — or, worse, an extra instruction line — in the prompt of a write-capable,
// commit-producing agent. Most of what is listed here is agent-supplied and constrained by nothing: `exclusions[].path`
// and `unit.paths` from the partitioner, the claude-md scan's paths. It need not even take a misbehaving agent, either:
// `git ls-files` — the enumeration those agents are told to use — can legitimately report a tracked filename containing
// a newline. Flattened once, here, so no caller can format a bullet that spans lines.
const bulletList = (items, empty) =>
  items?.length ? items.map((p) => `- ${String(p ?? '').replace(/\s+/g, ' ').trim()}`).join('\n') : empty;
const surveyBlock = (survey) =>
  `Repository survey (for context on the repo's purpose and conventions):\n${JSON.stringify(survey, null, 2)}`;

// A free-prose note one agent wrote for another to read — presently the partition agent's name for a unit, spliced into
// each of that unit's reviewer prompts. Same hazard as `knownLine`'s descriptions below: the author has just read the
// repository under review, so it is untrusted input for the same reason the SHA above is, and the schema constrains
// nothing about its contents. Spliced raw, its newlines let it read as fresh instruction lines rather than as the note it
// is presented as. So flatten it to one line and quote it, exactly as the `JSON.stringify(issue)` beside the other
// splices already does for the structured fields, and clamp it so a pathological note cannot crowd out the instructions
// it is attached to. The note is never the evidence — every prompt that carries one also names the files to read.
const AGENT_NOTE_BUDGET = 600;

const agentNote = (text) => {
  const note = String(text ?? '').replace(/\s+/g, ' ').trim();

  return JSON.stringify(note.length > AGENT_NOTE_BUDGET ? `${note.slice(0, AGENT_NOTE_BUDGET)}…` : note);
};

// The single wording of the "pre-existing" policy. It has to reach both ends of the pipeline: the reviewers, via
// `FALSE_POSITIVES`, and the validator that judges what they report. Stated twice it drifted into two variants, so the
// agent producing a finding and the agent vetting it were held to subtly different rules — hence one constant.
const PRE_EXISTING_NOTE =
  '"pre-existing" is NOT a reason to dismiss — every issue in a repository review is pre-existing. Judge each issue ' +
  'on whether it is real and significant today.';

const FALSE_POSITIVES =
  'Do NOT flag these (they are false positives): something that looks like a bug but is actually correct; pedantic ' +
  'nitpicks a senior engineer would not raise; issues a linter would catch; issues named in `CLAUDE.md` but explicitly ' +
  'silenced in the code (e.g. a lint-ignore comment); and deliberate, documented deviations where a comment explains ' +
  `why. Note: ${PRE_EXISTING_NOTE}`;

const REVIEW_RULES =
  'Do not build, typecheck, lint, or test the repository — review the source as written. You may consult authoritative ' +
  'upstream documentation to confirm how an external API, library, or framework behaves, but every finding must cite a ' +
  'location in this repository. Prefer `git ls-files` over `find`. If you are not certain an issue is real, do not flag ' +
  'it — false positives erode trust. Cite each issue with a file path and, where applicable, a line or range.';

// The read-only guard for the three phases whose own instructions only say *what* to enumerate: Survey, the
// `CLAUDE.md` scan, and Partition. Every phase of this workflow runs in the user's live checkout — nothing here sets
// `isolation: 'worktree'` — holding the full toolkit, and yet each of those three prompts used to say nothing about the
// tree at all: "enumerate with `git ls-files`" tells an agent how to list files, so quoting it as their guard named no
// prohibition a later edit could remove. Phrased as forbidden *actions*, and paired with the same "otherwise
// unrestricted" release the validators get, because enumerating widely is the entire job of these three.
// `read-only.test.js` holds this invariant for every phase.
const READ_ONLY_RULE =
  "You are working in the user's live checkout, not a sandbox: do not modify, create, or delete any file, and do " +
  'not build, typecheck, lint, or test the repository. Read-only inspection is otherwise unrestricted — read and ' +
  'enumerate as widely as the task needs.';

const SEVERITY_RUBRIC =
  'Severity reflects the impact if the issue is left unfixed: "critical" (security hole, data loss, or a defect that ' +
  'breaks core behaviour), "high" (wrong behaviour on a common path, or a serious maintainability trap), "medium" (a ' +
  'real defect with limited blast radius), "low" (a minor quality issue).';


// --- Round steering ------------------------------------------------------------------------------------------------
// Round 1 is the baseline pass — no emphasis and an empty feedback list, so its prompts are byte-identical to a review
// that never runs a second round. Rounds 2+ are steered toward what earlier ones missed by two additions: an escalating
// emphasis directive, and a scoped list of already-reported findings. Both survive the loop having moved out to the
// caller, because both are computed from `round` and `knownFindings` alone — neither needed the `for` loop that used to
// supply them, which is what makes a round a self-contained invocation.
//
// `ROUND_EMPHASIS` is indexed by 1-based round; rounds past the last entry reuse the deepest directive, so the caller
// can keep going without the steering degrading back towards the baseline.
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

// One finding, as a reviewer is shown it. The site comes from `issueSite` and the prose from `issueDescription` rather
// than either being formatted again here, so a finding named in this list is recognisable as the same finding wherever
// else the run mentions it — the dedupe digest most of all.
//
// `deduped` holds that prose untruncated, and by the last round of the measured run the largest unit was carrying 84
// findings — rendered in full, the list would outweigh the instructions it is attached to. So the caller passes a
// budget rather than one being fixed here, because the two lists below can afford different amounts of it.
const knownLine = (issue, budget) =>
  `- [${issue?.category}] ${issueSite(issue)} — ${issueDescription(issue, budget)}`;

// Render the "already reported, look elsewhere" feedback list; empty when there is nothing accumulated yet.
//
// A reviewer is shown every finding held for its unit, not only the ones in its own category. Filtering this list by
// category is what let a single defect be reported under four categories at once: the Bug reviewer was never told that
// Security had already flagged the same missing length check, so it flagged it too, and dedupe merged them afterwards
// at full review cost. Measured over one four-round run, 68% of the duplicates dedupe merged away sat in groups
// spanning more than one category — 40% of everything the reviewers produced.
//
// The two lists are worded differently because they carry different instructions. A finding in the reviewer's own
// category is a floor to look past. A finding from another reviewer only has to be recognised, so that this reviewer
// does not restate it from its own angle — while still leaving room for a genuinely different defect at the same site,
// which is the one thing showing the second list could otherwise suppress. Recognising a defect takes less text than
// looking past one, which is why the second budget is the smaller of the two.
const KNOWN_OWN_BUDGET = 220;

const KNOWN_OTHER_BUDGET = 110;

const knownFindingsBlock = (known, ownCategory) => {
  const own = (known || []).filter((issue) => issue?.category === ownCategory);
  const other = (known || []).filter((issue) => issue?.category !== ownCategory);

  return (
    (own.length
      ? '\n\nAlready reported in your category by earlier passes — do NOT re-report these; find what they missed:\n' +
        own.map((issue) => knownLine(issue, KNOWN_OWN_BUDGET)).join('\n')
      : '') +
    (other.length
      ? '\n\nAlready reported by another reviewer, in a category that is not yours to report. These defects are ' +
        'known — do not restate one from your own angle and do not re-report it under your category. Flag something ' +
        'at one of these sites only if it is a genuinely different defect:\n' +
        other.map((issue) => knownLine(issue, KNOWN_OTHER_BUDGET)).join('\n')
      : '')
  );
};

// A finding belongs to a unit when its primary file is one of the unit's paths or sits beneath one of them.
const fileInUnit = (file, unit) => !!file && (unit.paths || []).some((p) => underPath(file, p));

// Whether a unit path names a single file, which is the only thing that lets unit paths be *counted* as files (see
// `unitFiles`). A unit's `paths` are not constrained to files: `PARTITION_SCHEMA` accepts any string and `fileInUnit`
// above is deliberately written to match a finding *beneath* a path, so a partitioner answering `['src']` and
// `['test']` is legal — two strings covering a whole repository. A path is read as a file only when its last segment
// carries a letter-initial extension; a bare segment (`src`, `test/`, `pkg/v1.2`) is a subtree of unknown size. An
// extensionless file (`Makefile`) is therefore misread as a subtree, which errs the safe way for the one caller: an
// unknown-sized scope reviews as a repository rather than skipping the repository-level review.
const namesOneFile = (path) => /[^/]\.[A-Za-z][^./]*$/.test(String(path ?? '').replace(/\/+$/, ''));

// A unit's name is prose the partition agent wrote, and it lands inside two agent labels: `review:<unit>:<category>`
// and `dedupe:<unit>`. `/workflows` clips a label to about 40 columns from the right, so a title-cased name spends the
// budget the category needs — `review:Wire Protocol Layer:code-quality` was observed truncated to `…code-quality…`,
// losing which reviewer the row even was. The runtime does not truncate a label it is handed (it only collapses
// whitespace), so the whole budget is ours to spend.
//
// Hence a slug, sized so the parts that identify an agent always survive: `review:` plus a cap plus the longest
// category (`test-critique`) has to stay under that budget, which puts the cap at 16. What overflows is then the round
// tag, the one segment a reader can infer from context. A prose name is still what the reviewer is told to review.
const UNIT_SLUG_CAP = 16;

const unitSlug = (name) => {
  const slug = String(name || '')
    // Split camel case before lower-casing throws the boundary away, so `AuthenticationMiddleware` and `Authentication
    // Middleware` name the same unit the same way instead of one 24-character word and two shorter ones.
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (slug.length <= UNIT_SLUG_CAP) return slug;

  const clipped = slug.slice(0, UNIT_SLUG_CAP);

  // A cut landing exactly on a boundary already ends a word, so there is no partial segment to drop.
  if (slug[UNIT_SLUG_CAP] === '-') return clipped;

  // Otherwise cut back to the previous boundary, so `wire-protocol-layer` reads as `wire-protocol` and not as
  // `wire-protocol-la` — which reads as a bug. Only while enough survives to still identify the unit, though: cutting
  // `a-superlongwordhere` back to `a` trades a name that looks broken for one that says nothing.
  const boundary = clipped.lastIndexOf('-');

  return boundary >= UNIT_SLUG_CAP / 2 ? clipped.slice(0, boundary) : clipped;
};

// The two names the dedupe phase mints for itself in the same `dedupe:<name>` namespace unit slugs live in: the shared
// bucket `claimUnits` gives the findings no unit claimed, and the prefix every `crossDedupe` chunk label starts with.
// Declared here, next to the numbering that de-collides that namespace, because that numbering can only see names it is
// told about — and both are words a partition agent plausibly names a unit. `Cross-Cutting Concerns` slugs to exactly
// `cross-cutting`, which without this would label two concurrent stage-1 agents identically. Both stages read the name
// from here rather than spelling it again, so the reservation cannot drift away from what is actually used.
const DEDUPE_UNCLAIMED_SLUG = 'cross-cutting';
const DEDUPE_CROSS_SLUG = 'cross';

// Stamp each unit with the slug its agents are labelled by. Slugging maps distinct names onto the same slug — "Wire
// Protocol Layer" and "Wire Protocol Framing" both reach `wire-protocol` — and two units answering to one label would
// be two indistinguishable rows in `/workflows` and, in the dedupe phase, two scopes reported under one name. So
// number the repeats. A name that slugs away to nothing at all still needs something to be called. The reserved names
// above start out taken, so a unit reaching one of them is numbered off it exactly as a repeated unit name would be.
const withUnitSlugs = (units) => {
  const used = new Map([DEDUPE_UNCLAIMED_SLUG, DEDUPE_CROSS_SLUG].map((reserved) => [reserved, 1]));

  return (units || []).map((unit, i) => {
    const base = unitSlug(unit?.name) || `unit-${i + 1}`;
    let seen = (used.get(base) || 0) + 1;

    // The count is kept per base, but what a label carries is the numbered slug — and that slug is itself a name a unit
    // can arrive under. A second `core` is minted `core-2`, and a unit actually named `core-2` has a base no count has
    // ever been recorded for, so it would be minted `core-2` as well: the collision this whole function exists to
    // prevent, one number over. So step past every slug already handed out and record the minted one as taken in its
    // own right, which is also what keeps a fallback `unit-2` from being minted twice.
    while (seen > 1 && used.has(`${base}-${seen}`)) seen += 1;

    const slug = seen > 1 ? `${base}-${seen}` : base;

    used.set(base, seen);
    if (slug !== base) used.set(slug, 1);

    return { ...unit, slug };
  });
};

// Fold everything past the ceiling into a single unit, so the number of units a run reviews is bounded by what the
// partitioner was *told* rather than by what it chose to return. `units` multiplies every phase downstream of here, and
// leaving it to an agent's discretion is how a review of a 143-file repository came to spend a whole session limit
// without producing anything.
//
// Coalesced and not dropped. The surplus paths are in scope, the review is supposed to have covered them, and a bounded
// run that silently reports a partial review as a whole one is worse than an unbounded one — the cost is visible, but a
// hole in the coverage is not. Reviewing them as one coarse unit is worse than reviewing them as five coherent ones and
// far better than not reviewing them, and that is the entire trade the ceiling exists to make.
//
// The first `ceiling - 1` units survive untouched rather than the surplus being spread evenly across all of them: the
// units the partitioner actually reasoned about stay intact, and what is left is one identifiable bucket the report can
// name. Its `name` is what its reviewers are shown and what its agent labels are slugged from, so it says what it is
// rather than borrowing the name of whichever unit happened to be first over the line.
const COALESCED_UNIT_NAME = 'the remainder';

const coalesceToCeiling = (units, ceiling) => {
  if (!Number.isInteger(ceiling) || ceiling < 1 || units.length <= ceiling) return units;

  const surplus = units.slice(ceiling - 1);

  return [
    ...units.slice(0, ceiling - 1),
    { name: COALESCED_UNIT_NAME, paths: [...new Set(surplus.flatMap((unit) => unit.paths || []))] },
  ];
};

const claudeMdPrompt = () =>
  'List the repo-relative paths of every `CLAUDE.md` file in the repository (enumerate with `git ls-files`). Return ' +
  `only the paths — not their contents.\n\n${READ_ONLY_RULE}`;

// --- Dedupe: the agent judges, the script copies -------------------------------------------------------------------
// This phase used to hand the agent the whole union as JSON and ask it to return the merged findings, which made it
// reproduce every finding verbatim — ~50k output tokens for a 178-finding round, from a 162k-character prompt where the
// digest below needs 53k for a comparable round.
//
// That was NOT what kept killing the phase: the 180s no-progress watchdog was, at both contracts and every high effort
// tier (see the effort ladder above). The split is kept because it is right on its own terms. Deciding *which* findings
// collide is judgement; restating them is a copy — the expensive part, and the part a model can silently get wrong by
// rewording, truncating, dropping, or reordering. Order matters especially: the per-finding validator labels index
// into this array, and the old contract let the agent choose it. So the agent returns indices only and
// `mergeIssueGroups` does the copying below, where none of that is possible. Leaving ~3x less input to reason over is
// margin against that same watchdog, but margin is all it is — `DEDUPE_CHUNK_CAP` is what bounds the input for real.

// How much of each description the agent sees. Enough to recognise the same defect described twice; short enough that
// the prompt does not grow without bound in the finding count.
const DEDUPE_DESCRIPTION_BUDGET = 300;

// Where one finding lives, as every list that names findings to an agent renders it. `file` and `lines` are reviewer
// prose exactly as much as `description` is — a reviewer reads repository content that may itself carry adversarial
// text — and both the dedupe digest and the known-findings list are one line per finding, indexed or bulleted by that
// line. So a newline here forges a whole extra entry, and flattening only the description leaves the same hole open one
// field over. Flattened once, here, so no caller can format a site that spans lines.
const issueSite = (issue) =>
  String(issue?.lines ? `${issue.file}:${issue.lines}` : issue?.file || '')
    .replace(/\s+/g, ' ')
    .trim();

// One finding's prose, as every list in the run shows it. Descriptions are free reviewer text and routinely contain
// newlines, while every list that restates a finding puts it on a single line — a bullet in `knownFindingsBlock`, a
// numbered entry in the digest below, an item in `gaps`. Left in, one finding would read as several and the list would
// stop being a list. The budget is the caller's because those lists can afford different amounts of it.
//
// `slice` counts UTF-16 code units, so a budget landing between the halves of a surrogate pair — any emoji or other
// astral character straddling the cut — would keep the leading half on its own. A lone surrogate is not a character: it
// survives inside this process but every way the truncated line leaves it, written into a prompt or reported as a gap,
// encodes it as U+FFFD. So the orphan is dropped and the pair truncated whole.
const issueDescription = (issue, budget) => {
  const truncated = (issue?.description || '').replace(/\s+/g, ' ').slice(0, budget);
  const last = truncated.charCodeAt(truncated.length - 1);

  return last >= 0xd800 && last <= 0xdbff ? truncated.slice(0, -1) : truncated;
};

const dedupeDigest = (issues) =>
  issues
    .map((issue, i) => {
      const description = issueDescription(issue, DEDUPE_DESCRIPTION_BUDGET);

      return `${i}. [${issue?.severity}/${issue?.category}] ${issueSite(issue)} — ${description}`;
    })
    .join('\n');

// One finding, as a `gaps` entry names it. A gap is frequently the *only* surviving trace of the finding it is about —
// a finding whose validation never completed is reported nowhere else — so it has to say which file and lines, or the
// user is told something was lost without being told where to look. Naming the site through `issueSite` keeps it the
// same site the other lists show, and the budget is small because a gap is a one-line notice, not a report.
const GAP_DESCRIPTION_BUDGET = 80;

const gapFinding = (issue) =>
  `${issue?.category} finding at ${issueSite(issue)} — ${issueDescription(issue, GAP_DESCRIPTION_BUDGET)}`;

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

// The categories that validate at the Opus tier, with 3 validators under `--validators auto` (Phase 5), and that
// `/repo-review-fix` fixes at the Opus tier too. Declared here rather than beside that phase because the merge below has
// to preserve them: a finding's category is what selects the tier, so which member of a merged group survives is a risk
// decision, not a bookkeeping one.
//
// Which categories those are is read back off the rosters that define them, rather than listed again here — a category
// missing from a second list would validate on the cheap path without anything saying so. The lenses' repo-wide
// structural claims are the hardest of all to check, so they are always high-risk.
const HIGH_RISK = [
  ARCHITECTURE_CATEGORY,
  ...REVIEWERS.filter((reviewer) => reviewer.highRisk).map((reviewer) => reviewer.key),
];

const isHighRisk = (issue) => HIGH_RISK.includes(issue.category);

// Which member of a duplicate group survives — the first high-risk one, or the first member when none is high-risk.
//
// Risk is merged like severity, and for the same reason. Category is not a tie-break the reviewers negotiate: the union
// dedupe reasons over is `[...deduped, ...roundIssues]` with `roundIssues` in `REVIEWERS` order, so `security` always
// carries a higher index than `claude-md` or `code-quality` and would always lose a merge decided by position. Measured
// over one four-round run, 68% of the duplicates merged away spanned more than one category, so that is the common case
// rather than a corner: the security claim would be dropped, the merged finding would keep the escalated `critical` and
// then be validated by Sonnet — the tiering bypassed for exactly the findings it exists to protect.
//
// The whole surviving member is taken, not its category alone, so the finding stays coherent: a `security` label over a
// `code-quality` description would send its validator to check a claim nobody made. The absorbed member's site is kept
// in `otherSites` like any other, so nothing is lost. `reduce` keeps the incumbent on a tie, and `members` is sorted
// ascending, so a group of one risk tier still keeps its lowest-indexed member.
const survivingMember = (issues, members) =>
  members.reduce((keep, j) => (isHighRisk(issues[j]) && !isHighRisk(issues[keep]) ? j : keep));

// Symbol-keyed marks describe a *position* in the list being merged, not the content of the finding sitting there, so
// they come from the group's lowest-indexed member rather than from the member `survivingMember` kept. The only such
// mark is `NEW_THIS_ROUND`, which answers "is this a defect the review did not already hold?" — and only the lowest
// index can answer it, because the union puts everything accumulated ahead of this round's reports. Left to
// `{ ...primary }`, a re-report that wins the risk decision over the copy it is absorbed into would carry its own flag
// onto the merged finding, and would then be validated and offered to `/repo-review-fix` a second time.
const withMarksOf = (merged, source) => {
  for (const mark of Object.getOwnPropertySymbols(merged)) delete merged[mark];
  for (const mark of Object.getOwnPropertySymbols(source || {})) merged[mark] = source[mark];

  return merged;
};

// Apply the agent's groups to the findings it was shown. Every field is copied from the originals; the agent's answer
// only decides *which* findings collapse. Malformed groups degrade to "not merged" rather than corrupting the set: an
// out-of-range, non-integer, or already-claimed index is dropped, and a group left with fewer than two members is
// ignored. First group to claim an index wins, so overlapping groups cannot delete a finding twice.
const mergeIssueGroups = (issues, groups) => {
  if (!Array.isArray(issues)) return [];

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

  // Rebuilt in the original order: the group keeps its lowest member's place whichever member survives, so a dropped
  // group changes nothing but the merge, and the per-finding labels still index into a stable array.
  return issues.flatMap((issue, i) => {
    if (!primaries.has(i)) return claimed.has(i) ? [] : [issue];

    const members = primaries.get(i);
    const keep = survivingMember(issues, members);
    const primary = issues[keep];
    const others = members.filter((j) => j !== keep).map((j) => issues[j]);
    const primarySite = issueSite(primary);
    const otherSites = [
      ...new Set([
        ...(primary.otherSites || []),
        ...others.flatMap((other) => [issueSite(other), ...(other.otherSites || [])]),
      ]),
    ].filter((site) => site && site !== primarySite);

    // `issue` is the group's lowest-indexed member — `primaries` is keyed by `members[0]` — which is where the marks
    // come from, whichever member won the risk decision above. See `withMarksOf`.
    return [
      withMarksOf(
        { ...primary, severity: members.map((j) => issues[j].severity).reduce(worstSeverity), otherSites },
        issue,
      ),
    ];
  });
};

// Split a round's findings into the scopes dedupe runs over, so no single agent has to reason about every finding at
// once. One fan-in agent over the whole round is what the watchdog keeps killing, and the effort ladder above only buys
// one rung: measured on Opus at `high`, a 163-finding round answered in ~2 minutes and a 253-finding round was killed on
// all six attempts, then answered at `medium`. Think time tracks the digest, so the durable fix is to shrink the digest.
//
// Units are the split already available: file-disjoint by construction, and most duplicates live inside one, because
// the six reviewers all read the same code from different angles, so one defect can come back six times from a unit.
// Cross-unit duplicates exist too, so a second pass over the survivors still runs — but it starts from a smaller set.
// This is a partition, not a bound: unit sizes are the partitioner's choice, so `scopeDedupe` caps what comes out of it.
//
// A finding is scoped by its primary file, the same relation `fileInUnit` already uses to tell a reviewer which findings
// are known. This hands back the findings themselves rather than indices into a shared array, which is what lets a unit's
// scope be assembled — and deduped — from that one unit's reviewers, without waiting for the rest of the round. The
// numbering the agents work in is per scope now, and lives entirely inside `scopeDedupe`.
//
// It is a *partition* and not a per-unit classification: a finding goes to the first unit that claims it, so overlapping
// unit paths cannot place one finding in two scopes. Under the old shared-index union that mattered less, because
// `mergeIssueGroups` awarded an index to the first group to claim it and the worst case was "not merged twice". Now each
// scope merges its own list and the survivors are concatenated, so a finding in two scopes would come back twice — a
// duplicate the review invented rather than one it failed to remove.
const claimUnits = (issues, units) => {
  const owner = issues.map((issue) => (units || []).findIndex((unit) => fileInUnit(issue?.file, unit)));

  return {
    perUnit: (units || []).map((_unit, u) => issues.filter((_issue, i) => owner[i] === u)),

    // Whatever the partition does not claim: the repo-wide architecture findings, plus anything naming a file the
    // partitioner excluded or a reviewer misspelled. One shared bucket, so those are deduped against each other rather
    // than skipped — they are the findings most likely to be reported three times, once per architectural lens.
    unclaimed: issues.filter((_issue, i) => owner[i] < 0),
  };
};

// Translate a chunk's answer back into indices into the scope it was cut from. The agent numbers what it was shown from
// 0, so its groups mean nothing without this. An index outside what it was shown is dropped here, because
// `mergeIssueGroups` could not catch it: every chunk-local index is also a valid scope index, so the merge would
// collapse a stranger.
const globalizeGroups = (groups, indices) =>
  (Array.isArray(groups) ? groups : []).map((group) =>
    (Array.isArray(group) ? group : [])
      .filter((i) => Number.isInteger(i) && i >= 0 && i < indices.length)
      .map((i) => indices[i]),
  );

// One dedupe agent, run down the effort ladder; returns its groups, or `null` once every rung has failed.
//
// A stalled agent *throws* rather than resolving to `null`, and an unguarded throw out of a bare `await` is how a round
// that was 42 of 43 agents done got discarded whole. So each rung is wrapped, at both stages. Note that the stage-1
// callers additionally sit inside `parallel()`, where a rejection resolves to `null`: one unit going un-deduped must
// not cost the round the work every other unit already did.
const dedupeAgent = async (issues, { label }) => {
  const rungs = dedupeRungs(issues.length);
  const skipped = dedupeEfforts.filter((rung) => !rungs.includes(rung));

  // Never silently: a rung not attempted is a decision the reader should see, the same as a rung that failed.
  if (skipped.length) {
    log(
      `${label}: ${issues.length} findings is over the ceiling for ${skipped.join(', ')}, so it starts at ` +
        `${rungs[0]} instead of spending ~18 minutes per rung finding that out.`,
    );
  }

  for (const dedupeEffort of rungs) {
    try {
      const dd = await agent(dedupePrompt(issues), {
        // Every rung names its effort, the first one included. A step-down leaves the failed rung on screen in
        // `/workflows` permanently with nothing tying it to the row that recovered, so `dedupe:cross (retry 5) FAILED`
        // sitting above `dedupe:cross:medium` reads as a lost review rather than as a ladder working — it has misread
        // that way in practice. Naming both makes the pair legible.
        label: `${label}:${dedupeEffort}`,
        phase: 'Dedupe',
        model: 'opus',
        effort: dedupeEffort,
        schema: DEDUPE_SCHEMA,
      });

      // `groups: []` is a real answer — "nothing collided" — so test for the key, not for a truthy array.
      if (dd?.groups) return dd.groups;
    } catch (err) {
      log(`${label} stalled at effort ${dedupeEffort}: ${err?.message || err}`);
    }
  }

  return null;
};

// --- Chunking: the one bound on a dedupe digest, at both stages ----------------------------------------------------
// Stage 2 is where the need showed up first, because it sees every survivor accumulated so far. Measured on one
// four-round run: the cross pass was handed 116 findings in round 1, 209 in round 2 and 262 in round 3, while the
// largest single unit scope in that whole run was 68. So the fan-in grows with what a round is handed, however well the
// units are split, and the effort ladder just delays the wall — 209 exhausted `high`, and `medium` has no rung below it.
// Chunking is what actually bounds it, and `scopeDedupe` below is one mechanism for both stages, so the same cap covers
// a unit scope too — which matters, because a unit is only as small as the partitioner happened to make it.
//
// Chunking naively would be worse than not chunking. The union is built unit-major, so a contiguous slice of it is
// mostly one unit's findings — the duplicates stage 1 already merged — while the cross-unit pairs this stage exists to
// find sit far apart in that order. A slice-and-hope scheme would therefore spend its budget re-checking pairs that
// were already checked.
//
// So the chunks cover every pair instead: blocks of half a chunk, then one chunk per unordered pair of blocks. Any two
// findings share the chunk built from their two blocks, so the pass sees every pair that a single fan-in agent would
// have, at `C(m, 2)` calls rather than `m`. At 262 findings that is 6 calls of at most 150 instead of 4 of 66.
const DEDUPE_CHUNK_CAP = 150;

// Passes before the loop gives up and says so. A pass is repeated because `mergeIssueGroups` is first-claim-wins rather
// than transitive: chunks reporting {A,B} and {B,C} leave C unmerged, since B is already claimed when the second group
// is read. Re-running over the survivors closes one link of such a chain per pass, so three passes resolve a chain of
// four findings, and a pass that merges nothing means the set is genuinely converged.
const DEDUPE_CHUNK_PASSES = 3;

// The chunks one scope is cut into, as `{ name, indices }`. Every scope goes through this, per-unit and cross alike, so
// both stages label and globalize the same way. `name` is empty for the single chunk that holds everything, which is the common case and
// keeps the plain `dedupe:cross` label it has always had.
const crossChunks = (count, cap = DEDUPE_CHUNK_CAP) => {
  const all = Array.from({ length: Math.max(count, 0) }, (_, i) => i);

  if (all.length <= cap) return [{ name: '', indices: all }];

  // Half a chunk each, so any two blocks fit in one chunk together. `count > cap` gives at least three blocks, so
  // there is always more than one pair and the single-chunk case above is the only way to see the whole set at once.
  const half = Math.floor(cap / 2);
  const blocks = Array.from({ length: Math.ceil(all.length / half) }, (_, b) => all.slice(b * half, (b + 1) * half));

  return blocks.flatMap((block, a) =>
    blocks.slice(a + 1).map((other, b) => ({ name: `${a + 1}+${a + b + 2}`, indices: [...block, ...other] })),
  );
};

// One scope, deduped: chunk it, run an agent per chunk, merge every answer back. This is the whole of a stage-1 unit
// scope and the whole of one stage-2 pass, so the cap is owned in one place rather than applied twice.
//
// `claimUnits` *partitions* a round's findings; it does not bound the pieces, because a unit's size is the partitioner's
// free choice — a repository whose code sits mostly in one unit hands that whole scope to one agent, which is the
// unbounded fan-in `DEDUPE_CHUNK_CAP` exists to remove, ladder or no ladder. An over-cap scope is split by the
// pair-covering chunks above, keeping the guarantee that any two findings in a scope still share some chunk. A scope that
// fits the cap runs exactly one agent, under the plain `dedupe:<name>` label it has always had.
//
// Every index in here is local to `issues`, and that locality is what the per-unit pipeline is built on: stage 1 used to
// number one union assembled from every reviewer's answer, which is precisely why no scope could be deduped until all of
// them were in. A scope now carries its own numbering and nothing outside it needs to know the numbers at all.
//
// Chunking costs a scope the thing a single agent gave it for free: chains, since `mergeIssueGroups` is first-claim-wins.
// Nothing is lost, because splitting a scope necessarily leaves more than one chunk, which is what clears `whole` and
// sends the caller on to `crossDedupe` and its passes.
const scopeDedupe = async (issues, name) => {
  // One finding has nothing to be compared against, so an agent here could only answer `groups: []`, at Opus prices.
  if (issues.length < 2) return { issues, stalled: [], chunks: 0, largest: 0, whole: true };

  const chunks = crossChunks(issues.length);
  const nameOf = (chunk) => [name, chunk.name].filter(Boolean).join(':');

  // Each chunk is its own `dedupeAgent`, so it gets the effort ladder and the rung ceiling, and `parallel()` keeps one
  // stalled chunk from costing the merges every other chunk found.
  const results = await parallel(
    chunks.map((chunk) => () =>
      dedupeAgent(
        chunk.indices.map((i) => issues[i]),
        { label: `dedupe:${nameOf(chunk)}` },
      ).then((groups) => (groups ? globalizeGroups(groups, chunk.indices) : null)),
    ),
  );

  return {
    issues: mergeIssueGroups(issues, results.filter(Boolean).flat()),
    stalled: chunks.filter((_chunk, i) => !results[i]).map(nameOf),
    chunks: chunks.length,
    largest: Math.max(...chunks.map((chunk) => chunk.indices.length)),

    // Whether one agent compared everything in this scope, chains included — the only condition under which there is
    // nothing left for a further pass to find.
    whole: chunks.length === 1,
  };
};

// Run the cross-unit pass to convergence. Returns the surviving findings plus what the caller needs to report: how
// many chunks never came back, and whether the loop converged or ran out of passes.
const crossDedupe = async (issues) => {
  let survivors = issues;
  let stalled = 0;

  for (let pass = 1; pass <= DEDUPE_CHUNK_PASSES; pass += 1) {
    const before = survivors.length;

    // The pass number joins the scope name only once there is more than one pass to tell apart, so a review small
    // enough for a single chunk still shows the plain `dedupe:cross` it always did.
    const name = [DEDUPE_CROSS_SLUG, pass > 1 ? `p${pass}` : ''].filter(Boolean).join(':');
    const scope = await scopeDedupe(survivors, name);

    // The worst single pass, not the sum over passes. The number is reported as a count of chunks, and a chunk that
    // exhausts the effort ladder does it again next pass — same digest size, same ceiling — so summing would report one
    // slow chunk two or three times, above the chunk count any pass ever ran.
    stalled = Math.max(stalled, scope.stalled.length);
    survivors = scope.issues;

    log(
      `Cross-dedupe pass ${pass}: ${before} finding(s) over ${scope.chunks} chunk(s) of at most ` +
        `${scope.largest} -> ${survivors.length}.`,
    );

    // One chunk means one agent saw everything, chains included, so there is nothing a further pass could add. No
    // merge means the same conclusion by measurement rather than by construction.
    if (scope.whole || survivors.length === before) return { issues: survivors, stalled, converged: true };
  }

  return { issues: survivors, stalled, converged: false };
};

const surveyPrompt = () =>
  `Survey ${scope} to orient a code review. Use \`${lsFiles}\` to enumerate the files in scope (do not walk the ` +
  'filesystem, so ignored files stay out). Return: the primary programming languages; the build and test tooling; ' +
  'the entry points; the number of files in scope, which is exactly how many paths that command listed and nothing ' +
  "more; and, for orientation only, the whole repository's top-level directory structure with a file count per " +
  'directory. The last two are different numbers whenever a scope narrower than the repository is in effect. ' +
  'Finally, run `git rev-parse HEAD` and return its full 40-character output as `headSha` — the commit the rest of ' +
  `this review is defined against.\n\n${READ_ONLY_RULE}`;

// Like every phase of this workflow, Validate runs in the user's live checkout, so it needs the execution guard every
// other prompt already carries (`REVIEW_RULES` for the reviewers, "do not read files" for dedupe, `READ_ONLY_RULE` for
// the enumerating three). It matters most here: this is the highest fan-out phase, each validator holds Bash, and a
// claim about build or test behaviour is exactly the kind one would be tempted to settle by *running* the build. That
// would leave `node_modules/`, `dist/` or coverage output in the tree, breaking the read-only contract this command's
// whole posture rests on — and leaving `/repo-review-fix`, which runs next over the same checkout, unable to tell its
// own sandboxes' output from a dirty tree it inherited. The guard is phrased as forbidden *actions*, not as an
// exhaustive toolkit: read-only search is how a repository-wide claim gets confirmed at all, and a validator that read
// this as "no searching" would abstain, which on a strict-majority gate silently drops real findings.
// `read-only.test.js` holds this invariant for every phase.
const validatorPrompt = (issue, survey) =>
  'Independently validate whether the following reported issue is real, with high confidence. Open the actual ' +
  'file(s) yourself — or, for repository-wide findings, the relevant files and structure — rather than trusting the ' +
  'report\'s excerpt. Confirm the specific claim: e.g. if "variable is not defined" was flagged, verify that is ' +
  'actually true in the code; for a `CLAUDE.md` issue, confirm the cited rule is scoped for the file and is actually ' +
  'violated. Confirm only if the issue is truly an issue and significant today; note that ' +
  `${PRE_EXISTING_NOTE}\n\n` +
  'You are working in the live checkout, not a sandbox, so judge the claim from the source as written: do not modify, ' +
  'create, or delete any file, and do not build, typecheck, lint, or test the repository. Read-only inspection is ' +
  'otherwise unrestricted — read any file, and search and enumerate as widely as the claim needs (prefer ' +
  '`git ls-files` over `find`) — and you may consult authoritative upstream documentation for how an external API, ' +
  'library, or framework behaves. When the claim is itself about build or test behaviour, settle it from the source ' +
  'and the build/test configuration, and say in `rationale` what only running them could have settled.\n\n' +
  `Return \`{ confirmed, rationale }\`.\n\n` +
  `Issue:\n${JSON.stringify(issue, null, 2)}\n\n${surveyBlock(survey)}`;

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
    `subjective preferences or "this would be cleaner as X" rewrites. Return issues with category ` +
    `"${ARCHITECTURE_CATEGORY}". ` +
    `${REVIEW_RULES}\n\n${FALSE_POSITIVES}${extra}${emphasisBlock(roundCtx.round)}` +
    `${knownFindingsBlock(roundCtx.known, ARCHITECTURE_CATEGORY)}` +
    `\n\n${surveyBlock(survey)}`
  );
}

// With `--partitions auto`, scale the unit count to how much code is actually in scope. A fixed 4-8 range suits a whole
// repository but is pathological for a narrow `path` scope: told to find at least four units in a single file, the
// partitioner splits that file into conceptual slices, and since the Review phase is `units × REVIEWERS`, every
// invented slice costs six more reviewers all re-reading the same file. A count of 0 means the survey returned no
// usable in-scope count — treat the scope size as unknown and keep the repository-sized default.
//
// The range is data and the prose is derived from it, because the upper bound is also the *enforced* ceiling
// (`unitCeiling` below) and the two must not drift. They did: the number here was documented as capping the review at
// 4-8 units for any repository size, and for as long as it was prose only it capped nothing at all — a partitioner that
// returned thirty units got thirty units, six reviewers each. `units` is the multiplier every phase downstream is sized
// by, so it is the one number that has to be a bound rather than a request.
const autoUnitRange = (fileCount) =>
  !fileCount ? [4, 8]
  : fileCount <= 1 ? [1, 1]
  : fileCount <= 5 ? [1, 2]
  : fileCount <= 20 ? [2, 4]
  : [4, 8];

const autoUnitTarget = (fileCount) => {
  const [min, max] = autoUnitRange(fileCount);

  return min === max ? `exactly ${min} unit${min === 1 ? '' : 's'}` : `the range ${min}-${max}`;
};

// How many units the run will actually review, whatever comes back. An explicit `--partitions N` is a request for
// exactly N, so N is its own ceiling: a partitioner that returns more than it was told to has not been more helpful.
const unitCeiling = (fileCount) => (partitions === 'auto' ? autoUnitRange(fileCount)[1] : partitions);

// The survey's in-scope file count, coerced. A named helper rather than an inline expression because both the range
// asked for in the prompt and the ceiling enforced on the answer are derived from it, and the two have to agree.
const inScopeFiles = (survey) =>
  Number.isInteger(survey?.inScopeFileCount) && survey.inScopeFileCount > 0 ? survey.inScopeFileCount : 0;

function partitionPrompt(survey, fileCount) {
  // The ceiling is stated, and so is what happens past it. An unqualified "in the range 4-8" reads as a stylistic
  // preference to an agent that can see forty plausible modules, and it is not one: this is the number the whole review
  // is sized by. Told the consequence, the agent can choose which paths share a unit — a judgement it is far better
  // placed to make than the mechanical fold below, which just sweeps the surplus into one bucket.
  const ceiling = unitCeiling(fileCount);
  const target =
    partitions === 'auto'
      ? `Choose the number of units that best fits the scope, in ${autoUnitTarget(fileCount)}.`
      : `Partition into exactly ${partitions} units.`;

  return (
    `Partition ${scope} into coherent review units, using the survey below. ${target} That count is a hard ceiling and ` +
    `not a preference: units beyond the first ${ceiling} are folded into one bucket unit reviewed as a whole, so a ` +
    'thirty-unit answer is not a more thorough review — it is the same review with the last twenty-three units ' +
    'mechanically lumped together. Group deliberately instead: a large scope means large units, not more of them. ' +
    'Each unit should be a module, ' +
    // The script slugs whatever comes back, but a name chosen short reads better than one cut short: asking for it
    // yields `wire-protocol` where truncating a title yields `wire-protocol` from `Wire Protocol Layer` and, less
    // happily, `authentication` from `AuthenticationMiddleware`.
    'package, or directory group that can be understood on its own; give it a lower-case `kebab-case` name of at ' +
    `most ${UNIT_SLUG_CAP} characters (\`wire-protocol\`, not \`Wire Protocol Layer\`) and the list of ` +
    `repo-relative paths it covers (enumerate with \`${lsFiles}\`). Never split a single file across units — a unit is ` +
    'a set of whole files, and each file belongs to exactly one unit. Also return an explicit list of everything you ' +
    'excluded and why — exclude vendored/third-party dependencies, generated code, lock files, and binary files. Set ' +
    'each exclusion\'s `generated` to true when tooling produces that path rather than a human writing it (build ' +
    'output, bundles, compiled/transpiled output, lock files, installed or vendored dependencies) and false ' +
    'otherwise: this flag travels — `/repo-review-fix` reads it to forbid its fix agents from staging those paths, and ' +
    'it reads the flag, not your `reason` prose.\n\n' +
    `${READ_ONLY_RULE}\n\n` +
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
    // The unit's prose name, as the partition agent wrote it — untrusted for the same reason its paths are, and quoted
    // on its own line directly above the file list. `agentNote` renders it exactly as the hand-written quotes did for
    // any ordinary name, and flattens and escapes the one that would otherwise break out of them.
    `Review this unit: ${agentNote(unit.name)}.\n` +
    `Files in scope:\n${files}\n\n` +
    `${SEVERITY_RUBRIC}\n\n` +
    `Return a list of issues. For each: a description, a severity, the category "${reviewer.key}", the primary ` +
    'file and line/range (or the set of files/modules for repo-wide findings), and the reason it was flagged. ' +
    `${REVIEW_RULES}\n\n${FALSE_POSITIVES}${extra}`+
    `${emphasisBlock(roundCtx.round)}${knownFindingsBlock(roundCtx.known, reviewer.key)}` +
    `\n\n${surveyBlock(survey)}`
  );
}


// --- Validator risk model ------------------------------------------------------------------------------------------
// `HIGH_RISK` / `isHighRisk` — the categories where a wrong verdict is expensive, and so validate with the stronger
// model and a redundant panel of it — are declared up beside `mergeIssueGroups`, which also has to reason about risk to
// decide which member of a duplicate group survives.
//
// With `--validators auto`, high-risk categories get 3 independent validators and the rest get 1; an explicit count
// applies uniformly. `validators` was normalized to 'auto' or a positive integer at the top, so no parsing here.
const validatorCount = (issue) =>
  validators === 'auto' ? (isHighRisk(issue) ? 3 : 1) : validators;


// --- Agent labels for the per-finding phases -----------------------------------------------------------------------
// One handle per finding, shared by every agent that touches it, so a single finding can be followed across phases in
// the progress tree. Only the validators use it now that fixing is `/repo-review-fix`, but the shape is the same one
// that command's fixer labels take, so a finding reads the same in both progress trees.
const findingTag = (issue, idx) => `${issue.category}#${idx}`;

// Name a member of a redundant group only when the group has more than one member. `vote 1/1` is noise, and under the
// default `--validators 1` every label would carry it — which is how `validate:bug:3:0` came to end in a constant `:0`
// that looked like it meant something.
const voteTag = (k, count) => (count > 1 ? ` vote ${k + 1}/${count}` : '');


// --- Orchestration ------------------------------------------------------------------------------------------------
const gaps = [];

log(
  `Config — effort: ${effort}, partitions: ${partitions}, validators: ${validators}, round: ${round} ` +
    `(${knownFindings.length} finding(s) already held), ` +
    `scope: ${paths.join(', ') || 'whole repo'}.`,
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

// An abort still returns what the round was *handed*, not an empty list. This is the shape every exit below shares and
// it is load-bearing rather than tidy: the caller writes `findings` straight into its ledger and into the next round's
// `knownFindings`, so a round that aborts and reports nothing held would delete every round before it — the whole
// accumulated review destroyed by one Haiku agent that failed to answer. Aborting means this round added nothing, which
// is `newFindings: 0` plus the gap; it does not mean the review found nothing. (The one exception is the `args` abort at
// the top of the file, which could not read `knownFindings` in the first place and says so.)
if (!survey) {
  return {
    reviewedCommit: null,
    round,
    findings: knownFindings,
    newFindings: 0,
    exclusions: [],
    gaps: ['Survey agent did not return — review aborted (no repository context to work from).'],
  };
}

const claudeMdPaths = claudeMd?.paths ?? [];
if (!claudeMd) {
  gaps.push('`CLAUDE.md` scan did not return — compliance reviewers ran without a governing-file list.');
}

// A compliance reviewer audits against a rulebook, so a repository with no `CLAUDE.md` at all leaves it nothing to
// judge: handed an empty list it can only return nothing or invent a convention to measure the code against. Drop it
// in that case and record it, for the same reason the lens gate below does — a reviewer that never ran must not read
// as "`CLAUDE.md` compliance: clean". A scan that *failed* is the other case, gapped just above: the list is unknown
// rather than known-empty, so the reviewer still runs and reads the governing files itself.
const runClaudeMd = !claudeMd || claudeMdPaths.length > 0;

if (!runClaudeMd) {
  gaps.push('`CLAUDE.md` compliance not reviewed: the repository contains no `CLAUDE.md` file to audit against.');
}

const activeReviewers = runClaudeMd ? REVIEWERS : REVIEWERS.filter((reviewer) => reviewer.key !== 'claude-md');

// The commit this review is defined against. It is returned as `reviewedCommit` from every exit below, including the
// aborts: the wrapper anchors its permalinks to the reviewed tree, and asking it to re-derive that with its own
// `git rev-parse HEAD` made a value this script already holds a second source of truth, free to disagree the moment
// `HEAD` moved during the run. It also outlives the run — the wrapper stores it in the ledger, where `/repo-review-fix`
// reads it to tell each fixer how far the tree has drifted from the description it is being asked to act on, and to
// `git show` it when the drift makes the description doubtful. That is why it is validated as a bare, unabbreviated
// object name (`fullCommitSha`) even though nothing here interpolates it into a command line: an abbreviation is
// ambiguous at the far end and a non-hex string is untrusted input arriving in a prompt.
//
// A `null` here used to be recovered by a one-question re-ask before the Fix phase, which is where the value was needed.
// It is not needed anywhere in this workflow now, so the recovery moved out with the fixing: `/repo-review-fix` runs its
// own survey and gets its own answer. What remains here is worth *saying*, though — a round whose findings carry no
// commit is a round the wrapper cannot build a permalink from, so it is reported rather than left to be inferred from a
// `reviewedCommit: null` in the return value.
const reviewHead = fullCommitSha(survey.headSha);

if (reviewHead) {
  log(`Reviewing at ${reviewHead.slice(0, 10)}.`);
} else {
  gaps.push(
    'Findings are not anchored to a commit: the survey did not report a usable 40-character `HEAD` SHA, so ' +
      '`reviewedCommit` is empty. The findings themselves stand — but no permalink can be built for them, and a later ' +
      'round cannot tell whether the tree has moved under the ledger.',
  );
}

// How much code is in scope, used below to scale the `auto` partitions range — a range right-sized for a repository is
// pathological for a `path` scope of a file or two. This must come from the survey's dedicated in-scope count and not
// from summing `structure`: `structure` describes the whole repository whatever the scope, so summing it reported ~170
// files for a single-file review and the range never narrowed. 0 means no usable count — treated as unknown, keeping
// the repository-sized default rather than guessing small.
const surveyedFiles = inScopeFiles(survey);

log(
  surveyedFiles
    ? `${surveyedFiles} file(s) in scope.`
    : 'Survey returned no in-scope file count — sizing the review with repository-wide defaults.',
);

// Phase 2 — Partition (Sonnet, full requested effort).
phase('Partition');

// A stalled agent *throws* rather than resolving to `null` (see `dedupeAgent`), and this call sits outside both
// `parallel()` and any `try`, so an unguarded throw would escape the workflow entirely — bypassing the fallback
// immediately below, which exists precisely to report an unusable partition as a structured abort.
let partition = null;

try {
  partition = await agent(partitionPrompt(survey, surveyedFiles), {
    label: 'partition',
    phase: 'Partition',
    model: 'sonnet',
    effort,
    schema: PARTITION_SCHEMA,
  });
} catch (err) {
  log(`Partition agent stalled: ${err?.message || err}`);
}

if (!partition?.units?.length) {
  return {
    reviewedCommit: reviewHead,
    round,
    findings: knownFindings,
    newFindings: 0,
    exclusions: partition?.exclusions ?? [],
    gaps: ['Partition agent did not return usable units — review aborted.'],
  };
}

// The requested scope, enforced on the way out of the Partition phase — the one place it can be enforced, since from
// here on `unit.paths` *is* the scope every phase works from (see `narrowToScope`). A unit the narrowing emptied is
// dropped whole: six reviewers pointed at a file list of nothing they were asked about is pure cost. That drop is part
// of enforcing a requested scope, so with no `--path` it does not apply: there, `narrowToScope` only sanitises, and a
// unit arriving with no paths of its own is a partitioner describing a scope it did not enumerate, not one that fell
// outside what was asked for. The phases below already read that as an unknown scope size and review it anyway, so
// filtering unconditionally would abort the run instead. Narrowed before slugging, so the numbering of repeated slugs
// counts only the units that survive.
//
// Capped after the narrowing and before the slugging: the narrowing can drop enough units to bring the count back under
// the ceiling on its own, and slugging last means the numbering of repeated slugs counts only units that survived both.
// The ceiling is derived from the same file count `partitionPrompt` was given, so the number enforced here is the number
// the agent was told, not a second opinion about the scope computed from the answer it sent back.
const scoped = partition.units.map((unit) => ({ ...unit, paths: narrowToScope(unit?.paths) }));
const inScope = paths.length ? scoped.filter((unit) => unit.paths.length) : scoped;
const capped = coalesceToCeiling(inScope, unitCeiling(surveyedFiles));
const units = withUnitSlugs(capped);
const exclusions = partition.exclusions || [];

// Nothing left to review is a failure to report, not a clean review of nothing: an agent whose whole answer fell
// outside the scope has not partitioned what was asked for.
if (!units.length) {
  return {
    reviewedCommit: reviewHead,
    round,
    findings: knownFindings,
    newFindings: 0,
    exclusions,
    gaps: [
      `Partition agent returned ${partition.units.length} unit(s) but no path within ${scope} — review aborted ` +
        'without reviewing anything. Re-run it: what came back is not the scope that was requested.',
    ],
  };
}

// An overreach that was merely trimmed still gets said out loud, since what was discarded was never reviewed.
const droppedPaths = new Set(partition.units.flatMap((unit) => unit?.paths || []));
units.forEach((unit) => unit.paths.forEach((p) => droppedPaths.delete(p)));

if (droppedPaths.size) {
  log(`Narrowed the partition to ${scope}: ${droppedPaths.size} path(s) it returned were not within it.`);
}

// A gap and not just a log line, because the difference is invisible in the output otherwise. Every finding the review
// produces is reported the same way whichever unit found it, so a bucket of twenty modules read by one set of reviewers
// returns a shorter list than twenty units would have and nothing in that list says why. The reader is entitled to know
// that "no issues in `src/legacy`" came out of a review that saw `src/legacy` as one file list among many, especially
// since the fix pipeline will offer to act on what did come back.
if (capped.length < inScope.length) {
  const folded = inScope.length - capped.length + 1;

  gaps.push(
    `Partition agent returned ${inScope.length} unit(s), over the ceiling of ${capped.length} this review is sized ` +
      `for. The last ${folded} were folded into a single "${COALESCED_UNIT_NAME}" unit covering ` +
      `${capped[capped.length - 1].paths.length} path(s), reviewed as one scope — so those paths were reviewed more ` +
      'coarsely than the rest. Re-run with an explicit `--path` to give any of them a review of their own.',
  );
}

// The distinct paths the reviewers will actually open, and how many files those paths are known to be. The file count,
// not the survey's, is what the lens gate below keys on: it is the review's real scope, already narrowed by the
// partitioner's exclusions and by the requested paths, and it cannot be inflated by a surveyor answering a
// repository-shaped question about a one-file scope. Counting the paths themselves would be wrong, though — the
// partitioner may hand back a directory per unit (`namesOneFile` says why), and `paths: ['src']` plus `paths: ['test']`
// counted as two files skipped the structural review of an entire repository and reported it as too small to have one.
// So a scope holding any path that is not a single file has an unknown file count — 0, which the gate already reads as
// unknown and runs the lenses for.
const unitPaths = [...new Set(units.flatMap((unit) => unit.paths || []))];
const unitFiles = unitPaths.every(namesOneFile) ? unitPaths.length : 0;

log(`Partitioned into ${units.length} unit(s) over ${unitPaths.length} path(s); ${exclusions.length} exclusion(s).`);

// What this round starts from. Round 1 is the baseline pass; a later round feeds each reviewer an escalating emphasis
// and a scoped list of what is already held, so it looks where earlier rounds did not.
//
// `deduped` starts holding what those rounds found rather than empty, because both dedupe stages merge this round's raw
// findings *against* it — that is what turns a re-report into an absorbed duplicate instead of a second entry, and it is
// the whole reason a round can be a self-contained invocation. It also makes the accumulated set what this round returns:
// the caller gets back exactly what it handed over, plus whatever survived here.
let deduped = knownFindings;

// The mark this round's own findings carry through both dedupe stages, so everything below can tell them from the ones
// that arrived on `args` without comparing content. A symbol-keyed own property survives `mergeIssueGroups`, which
// carries a merged group's marks over from its lowest-indexed member (`withMarksOf`), while staying out of every prompt
// digest, out of the JSON the run returns, and out of reach of any field name a reviewer might use. Nothing on
// `knownFindings` can carry it either way: those made a round trip through the wrapper's JSON, which has no symbols.
//
// Three things read it, and the last two are why it is not merely a counter. `newFindings` is the number the caller
// stops on. Validate runs only over the marked findings, because a finding that arrived on `args` was already confirmed
// by the round that produced it — re-judging it would make round 4 pay for rounds 1 through 3 again, which is the cost
// shape moving the loop out was meant to remove. And `newFindings` is what the wrapper reports as this round's
// contribution. The mark surviving from the *lowest* index is what makes both safe: the known findings sit below this
// round's in the union, so a re-report merged into a copy already held loses the mark and is neither re-judged nor
// re-counted, which is exactly right.
const NEW_THIS_ROUND = Symbol('found in this round');

// The architecture lenses assess repository-level structure, so on a scope of one or two files there is nothing
// structural to assess — three whole-repo Opus agents would return noise at best. Skip them below that threshold and
// record it: a lens that never ran must not read as "architecture: clean". An unknown scope size still runs them.
const runLenses = !unitFiles || unitFiles > 2;

if (!runLenses) {
  gaps.push(`Architecture lenses not run: only ${unitFiles} file(s) in scope — too small for a structural review.`);
}

// Labels carry no round marker. They used to — ` round k/n` after the colon-delimited identity, suppressed when there
// was only one round — because a single `/workflows` tree held every round of a looped run and two rounds' `dedupe:core`
// rows were otherwise indistinguishable. One round per invocation is one tree per round, so the marker now says only
// what the tree it is drawn in already says, and dropping it restores the bare labels the single-pass run always had.
// That matters beyond legibility: a label is part of the resume cache key, so an un-tagged label is one a resumed run
// can still match.

// Phases 3 & 4, as one `pipeline()` over the units. A unit's reviewers run concurrently among themselves, and the moment
// that unit's own answers are in, its dedupe scope is assembled and deduped — without waiting for any other unit. There
// is no barrier between the two phases, which is the point: as a `parallel()` pair they cost the slowest reviewer in the
// *whole round* before the first dedupe agent could start, and a run killed anywhere in that window produced nothing at
// all. Both phases are still bounded by the unit ceiling; what changed is that the waiting is per unit.
//
// Only stage 1 of dedupe fits inside the pipeline. The cross-unit pass exists precisely to compare findings from
// different units, so it is a genuine barrier and stays one, below.
//
// The architecture lenses are not units — each reads the whole repository — so they run alongside the pipeline rather
// than in it, and their findings join the leftovers scope after the barrier.
phase('Review');

// The held findings, partitioned once, by the same rule the round's own findings will be. This is not the same question
// as what a reviewer is *told* is known: overlapping unit paths make `claimUnits` award a finding to one unit, while
// every reviewer that can see the file should hear about it, so the prompt below keeps its own unscoped filter.
const held = claimUnits(deduped, units);

// Counted apart from the findings: a reviewer that came back with an empty list is evidence its unit is clean, and
// one that never came back is no evidence at all. Only the first kind can make an empty round mean the review is dry.
let reviewersReturned = 0;
let reviewersRun = 0;

// Raw findings, counted before any merging, because that — and not the number that survived dedupe — is what decides
// whether this round looked and found nothing. A round whose every finding was absorbed as a duplicate of something
// already held did produce evidence; it is just evidence that the review has converged, which `newFindings` reports.
let rawFound = 0;

// Run a set of reviewers concurrently and read their answers. Findings are fingerprinted as they are read, after the
// category is stamped and never before: `category` is one of the three fields the identity is built from, and the
// reviewer's own answer for it is overwritten by the roster's key on that very line. `NEW_THIS_ROUND` goes on here too,
// so that everything downstream can tell this round's findings from the ones that arrived on `args` without comparing
// content — and so that no later stage has to remember to mark them.
const reviewIssues = async (specs) => {
  reviewersRun += specs.length;

  const results = await parallel(
    specs.map((spec) => () =>
      agent(spec.prompt, {
        label: spec.label,
        phase: 'Review',
        model: spec.model,
        effort: spec.effort,
        schema: ISSUES_SCHEMA,
      }),
    ),
  );

  return results.flatMap((result, i) => {
    if (!result?.issues) {
      gaps.push(`Reviewer did not complete: ${specs[i].label}`);

      return [];
    }

    reviewersReturned += 1;
    rawFound += result.issues.length;

    return result.issues.map((issue) =>
      withFingerprint({ ...issue, category: specs[i].category, [NEW_THIS_ROUND]: true }),
    );
  });
};

const lensSpecs = runLenses
  ? ARCHITECTURAL_LENSES.map((lens) => ({
      label: `review:arch:${lens.key}`,
      model: 'opus',
      effort,
      category: ARCHITECTURE_CATEGORY,
      prompt: architecturalLensPrompt(lens, survey, claudeMdPaths, {
        round,

        // A lens reads the whole repository, so there is no unit to scope by and it sees everything held. That is
        // the largest known-findings block the run produces, and deliberately so: the measured architecture
        // duplicates were against `code-quality`, `consistency` and `bug`, none of which a category filter shows.
        known: deduped,
      }),
    }))
  : [];

const [unitScopes, lensIssues] = await parallel([
  () =>
    pipeline(
      units,
      // Stage 1 — this unit's reviewers, at capped leaf effort.
      (unit) =>
        reviewIssues(
          activeReviewers.map((reviewer) => ({
            label: `review:${unit.slug}:${reviewer.key}`,
            model: reviewer.model,
            effort: leafEffort,
            category: reviewer.key,
            prompt: reviewerPrompt(reviewer, unit, survey, claudeMdPaths, {
              round,

              // Scoped by unit, not by category: a reviewer that cannot see the other five reviewers' findings for its
              // own unit re-reports them, and `mergeIssueGroups` then pays for that at full review cost.
              known: deduped.filter((f) => fileInUnit(f.file, unit)),
            }),
          })),
        ),

      // Stage 2 — this unit's dedupe, as soon as its own reviewers are in and not a moment later.
      async (raw, unit, u) => {
        // A reviewer may cite a file outside the unit it was given. That finding cannot be deduped here — the unit that
        // owns the file may already have finished — so anything this unit does not claim is handed to the leftovers
        // scope after the barrier. Nothing is lost by that: `crossDedupe` compares every surviving pair, so a misrouted
        // finding still meets the copy already held, one stage later than it would have.
        const mine = new Set(claimUnits(raw, units).perUnit[u]);
        const strays = raw.filter((issue) => !mine.has(issue));

        // Held findings first, this round's after — the ordering `NEW_THIS_ROUND` depends on, here within one scope.
        const scope = [...held.perUnit[u], ...mine];

        // A unit that found nothing new has nothing to merge: its held findings were deduped by the round that produced
        // them, and re-comparing a settled set is a full Opus agent spent to be told `groups: []`. Under the shared
        // union this ran anyway, once per unit, on every round after the first.
        if (mine.size === 0) return { issues: scope, strays, stalled: [], chunks: 0, whole: true };

        return { strays, ...(await scopeDedupe(scope, unit.slug)) };
      },
    ),

  // The lenses have no unit and so no stage-1 scope of their own; every finding they raise is a leftover by construction.
  () => reviewIssues(lensSpecs),
]);

// A unit's stage dying takes its whole pipeline item down, and that item is where the findings already held for the unit
// were waiting to be merged. `pipeline()` reports it as a `null`, so a `null` is refilled from `held` rather than skipped:
// dropping it would erase every earlier round's findings for that unit from the ledger, the same failure the three abort
// returns above exist to prevent. What this round found for the unit died with the stage and is not recoverable, so this
// is a partial review and it says so.
const scopes = units.map((unit, u) => {
  const scope = unitScopes?.[u];

  if (scope) return scope;

  gaps.push(
    `Review and dedupe of unit '${unit.slug}' in round ${round} failed outright, so it contributed nothing — the ` +
      `${held.perUnit[u].length} finding(s) already held for it are carried unchanged. Re-run the review.`,
  );

  return { issues: held.perUnit[u], strays: [], stalled: [], chunks: 0, whole: true };
});

log(
  `Round ${round}: ${rawFound} raw finding(s) from ${reviewersReturned} of ${reviewersRun} ` +
    `reviewer(s) over ${units.length} unit(s).`,
);

// A round that raised nothing has nothing to dedupe against what is held and nothing to validate, and
// the set it holds is the one it was handed — already deduped and already confirmed by the rounds that produced it. So
// return it here rather than paying a cross pass to re-merge a settled set and a Validate pass to re-confirm it. Every
// per-unit scope skipped its own agent for the same reason, so a dry round now costs nothing beyond the reviewers.
// `newFindings: 0` is what tells the caller the review has gone dry and there is no round after this one.
if (rawFound === 0) {
  // An empty round only means the review went dry if somebody actually looked. When every reviewer failed, the round
  // says nothing about the code, and the per-reviewer gaps above do not add up to that: read one at a time they look
  // like partial coverage, while `newFindings: 0` reads as convergence. Say it once, plainly, so an empty `findings`
  // list cannot be reported as "No issues found" — and so a caller does not stop looping on a review that never ran.
  if (reviewersReturned === 0) {
    gaps.push(
      `All ${reviewersRun} reviewer(s) in round ${round} failed to return, so nothing was reviewed in it — ` +
        'this round found nothing because of that, not because the code is clean. Re-run the review.',
    );
    log(`Round ${round}: no reviewer returned — nothing was reviewed.`);
  } else {
    log(`Round ${round} produced no findings — the review is dry.`);
  }

  return { reviewedCommit: reviewHead, round, findings: knownFindings, newFindings: 0, exclusions, gaps };
}

// Dedupe, stage 2 (Opus). A deterministic script cannot reason over findings, so this is delegated. Stage 1 already ran
// inside the pipeline above, one scope per unit; what is left is the scope no unit owns, and then the pass that compares
// findings *across* units — which is the one part of this phase that genuinely needs every reviewer's answer, and
// therefore the only barrier left between Review and Validate.
phase('Dedupe');
const prevCount = deduped.length;

// The leftovers: everything no unit claimed. The repo-wide lens findings, the strays a reviewer cited outside its own
// unit, and the held findings naming a file the partition no longer covers. One shared scope, so those are at least
// compared against each other rather than skipped — they are the likeliest triplicates in the round, one per lens.
// Held first here too, so a lens re-reporting a held finding is absorbed into the copy the ledger already knows.
const unclaimed = [...held.unclaimed, ...scopes.flatMap((scope) => scope.strays), ...(lensIssues ?? [])];
const leftovers = await scopeDedupe(unclaimed, DEDUPE_UNCLAIMED_SLUG);

const allScopes = [...scopes, leftovers];
const stalledScopes = allScopes.flatMap((scope) => scope.stalled);
const scopeCount = allScopes.reduce((total, scope) => total + scope.chunks, 0);

if (stalledScopes.length) {
  gaps.push(
    `Dedupe did not return for ${stalledScopes.length} of ${scopeCount} scope(s) in round ${round} ` +
      `(${stalledScopes.join(', ')}) — those findings were kept raw, so one defect may be reported more than once.`,
  );
}

// Every scope merged its own list; concatenating them gives the round minus its intra-unit duplicates, in unit order —
// which is the order the per-finding validator labels index into.
//
// Re-partitioned so that everything held sits below everything new, across scopes and not merely inside one.
// `mergeIssueGroups` carries a group's marks over from its lowest-indexed member, so this is what decides which copy of a
// re-reported defect survives the cross pass. With one unit's new findings sitting above another unit's held ones, the
// new report would win: the ledger's entry would be replaced, losing its `firstSeen` and everything the round that first
// saw it recorded, and the defect would then be re-validated and re-counted as though it had never been reported.
const merged = allScopes.flatMap((scope) => scope.issues);
const afterUnits = [
  ...merged.filter((issue) => !issue[NEW_THIS_ROUND]),
  ...merged.filter((issue) => issue[NEW_THIS_ROUND]),
];

// The cross pass exists to catch one defect reported under two different units, so it has nothing to add when a single
// scope already compared everything: re-asking would only spend a rung of the ladder on a settled question. It takes one
// *unchunked* scope for that, so an over-cap round always reaches `crossDedupe` and the passes that close the chains
// chunking splits up — and so does a round whose findings landed in more than one scope, however small.
const compared = allScopes.filter((scope) => scope.issues.length > 0);
const wholeUnionScoped = compared.length === 1 && compared[0].chunks === 1;
const cross =
  wholeUnionScoped || afterUnits.length < 2
    ? { issues: afterUnits, stalled: 0, converged: true }
    : await crossDedupe(afterUnits);

if (cross.stalled) {
  gaps.push(
    `${cross.stalled} chunk(s) of the cross-unit dedupe pass did not return in round ${round} — duplicates inside ` +
      'a unit were still merged, but one defect reported under two different units may appear twice.',
  );
}

// Running out of passes is not the same as a stall: every chunk answered, but a chain of duplicates may still be
// partly unmerged, because one pass closes one link of it.
if (!cross.converged) {
  gaps.push(
    `The cross-unit dedupe pass was still merging findings after ${DEDUPE_CHUNK_PASSES} passes in round ${round} — ` +
      'a defect reported under three or more units may appear twice.',
  );
}

deduped = cross.issues;

log(
  `Deduped round ${round}: ${prevCount + rawFound} -> ${deduped.length} finding(s) over ${scopeCount} scope(s) ` +
    `(${prevCount} before this round).`,
);

// This round's own survivors: the findings it raised that dedupe kept as findings of their own rather than absorbing
// into a copy already held. Everything from here to the end of the run is scoped by this list rather than by `deduped`.
//
// Read off the marks rather than differenced against `prevCount`, because the total also shrinks when dedupe merges two
// findings from *earlier* rounds — which the chunked cross pass leaves for a later round by design, since
// `DEDUPE_CHUNK_PASSES` bounds how much of a duplicate chain one round can close. Differenced, three such late merges
// cancel two genuine new defects and a productive round reads as dry, so the caller stops and the rounds the user asked
// for never run.
const newThisRound = deduped.filter((issue) => issue[NEW_THIS_ROUND]);

log(`Round ${round}: ${newThisRound.length} of the round's finding(s) survived dedupe as new.`);

// Phase 5 — Validate (barrier). Per issue, run `--validators` independent validators; keep on a strict majority of those
// that return. High-risk categories (`HIGH_RISK`, declared with the dedupe merge that has to preserve them) validate
// with Opus, the rest with Sonnet; both at capped leaf effort.
//
// Only over `newThisRound` — see `NEW_THIS_ROUND`. A finding that arrived on `args` came from a round that already put
// it through this gate, and validation is the second-largest fan-out in the run (`findings × --validators`), so
// re-judging the accumulated set every round is the multiplier this redesign exists to remove.
phase('Validate');

// The run's one quorum rule: Validate's redundant panel deciding whether a finding is real. Only the agents that
// actually returned get a vote, and passing needs a *strict* majority of them (>, not >=, so 1-of-2 does not pass).
// `completed: false` means nothing returned at all: the gate could not run, which is a gap for the caller to record
// rather than a verdict — and `passed` is false there too, so a gate that never ran can never read as an approval.
// `/repo-review-fix` carries its own copy of this rule for its fix-review gate; the two cannot share code, since a
// workflow script has no imports.
const quorum = (votes, isYes) => {
  const returned = votes.filter(Boolean);

  return {
    returned,
    completed: returned.length > 0,
    passed: returned.filter(isYes).length > returned.length / 2,
  };
};

// A finding's number is its position in `deduped`, read off the finding itself rather than off whichever loop is
// iterating it. Validate runs only over `newThisRound`, which is a *subset* of `deduped`, so numbering by loop position
// would give the same finding a different number depending on how much of the ledger this round happened to re-find —
// and the returned `findings` array, which the wrapper reports against, is `deduped` order.
const findingNumbers = new Map(deduped.map((issue, idx) => [issue, idx]));

// The only place a finding's number is supplied to `findingTag`, so no call site can label a finding by its loop
// position instead. `findingTag` itself stays a pure declaration above the marker, where a unit test can reach it.
const tagOf = (issue) => findingTag(issue, findingNumbers.get(issue));

const verdicts = await parallel(
  newThisRound.map((issue) => async () => {
    const count = validatorCount(issue);
    const model = isHighRisk(issue) ? 'opus' : 'sonnet';
    const votes = await parallel(
      Array.from({ length: count }, (_, k) => () =>
        agent(validatorPrompt(issue, survey), {
          label: `validate:${tagOf(issue)}${voteTag(k, count)}`,
          phase: 'Validate',
          model,
          effort: leafEffort,
          schema: VERDICT_SCHEMA,
        }),
      ),
    );

    const { completed, passed } = quorum(votes, (v) => v.confirmed);

    if (!completed) {
      gaps.push(`Validation did not complete for a ${gapFinding(issue)}`);
      return null;
    }

    return passed ? issue : null;
  }),
);

// What the review holds after this round: everything it was handed that dedupe kept, plus this round's confirmed
// additions. Filtered out of `deduped` rather than concatenated, so the order — and with it every `findingTag` number
// already minted from `findingNumbers` — is the one the phases above were labelled against. Only the *new* findings can
// be dropped here, because only they were judged; a known finding is carried whether or not it would pass again.
const confirmed = new Set(verdicts.filter(Boolean));
const newlyConfirmed = deduped.filter((issue) => issue[NEW_THIS_ROUND] && confirmed.has(issue));
const findings = deduped.filter((issue) => !issue[NEW_THIS_ROUND] || confirmed.has(issue));

log(
  `Round ${round}: ${newlyConfirmed.length} new finding(s) confirmed of ${newThisRound.length} judged; ` +
    `${findings.length} held in total; ${gaps.length} gap(s).`,
);

// Everything the review has to say, and nothing more: this workflow does not write. Fixing these findings is
// `/repo-review-fix`, a separate command over the ledger the wrapper persists from this return value — the split is why a
// re-review no longer has to happen before a fix can, and why nothing here needs git access.
return { reviewedCommit: reviewHead, round, findings, newFindings: newlyConfirmed.length, exclusions, gaps };
