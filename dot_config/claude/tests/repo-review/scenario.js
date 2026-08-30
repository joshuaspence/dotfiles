/**
 * Scenario fixtures for `repo-review.js`.
 *
 * Reaching the Fix phase means satisfying five earlier phases of agents (survey, CLAUDE.md scan, partition, six
 * reviewers, dedupe, validators), none of which a test about a fix branch cares about. `fixScenario` supplies a working
 * default for all of them and lets a test override only the part under examination.
 *
 * Everything is keyed off the agent labels, which encode the finding index, revision attempt and vote — so a scenario
 * can answer per-finding without the test having to know the order agents happen to run in.
 */

import { onTestFinished } from 'vitest';

import { loadInternals, runWorkflow, workflowScript } from '../harness.js';

// Resolved by name from the workflow source directory, so this is the only place the script under test is identified.
export const SCRIPT = workflowScript('repo-review');

// The internals these tests examine. Named explicitly rather than discovered: renaming one should fail here loudly
// instead of quietly dropping whatever it used to cover. Only internals a test actually reads belong here — a name no
// test touches is covering nothing, so listing it would just make renaming a private helper fail every suite that
// imports this fixture.
const INTERNALS = [
  // Argument handling and the config knobs derived from it.
  'capEffort',
  'dedupeEfforts',
  'DEDUPE_RUNG_CEILING',
  'dedupeRungs',
  'DEDUPE_CHUNK_CAP',
  'DEDUPE_CHUNK_PASSES',
  'crossChunks',
  'chunkScopes',
  'effort',
  'EFFORT_ORDER',
  'fix',
  'input',
  'leafEffort',
  'knownFindings',
  'lsFiles',
  'narrowToScope',
  'paths',
  'reviewers',
  'round',
  'scope',
  'underPath',
  'validators',

  // The risk model `--validators auto` resolves through, and the label grammar every per-finding agent is keyed off.
  'attemptTag',
  'findingTag',
  'HIGH_RISK',
  'validatorCount',
  'voteTag',

  // Untrusted-input guards.
  'containedSites',
  'isRepoRelativePath',
  'isSafeBranchName',
  'isSafeRepoPath',
  'isSandboxBranch',
  'PLACEHOLDER_RUN_IDS',
  'runIdTally',
  'sitePaths',

  // Grouping and sizing.
  'autoUnitRange',
  'autoUnitTarget',
  'coalesceToCeiling',
  'COALESCED_UNIT_NAME',
  'inScopeFiles',
  'unitCeiling',
  'DEDUPE_CROSS_SLUG',
  'dedupeScopes',
  'DEDUPE_UNCLAIMED_SLUG',
  'fileInUnit',
  'globalizeGroups',
  'issueSite',
  'mergeIssueGroups',
  'namesOneFile',
  'UNIT_SLUG_CAP',
  'unitSlug',
  'withUnitSlugs',

  // Prompt builders.
  'AGENT_NOTE_BUDGET',
  'agentNote',
  'architecturalLensPrompt',
  'bulletList',
  'DEDUPE_DESCRIPTION_BUDGET',
  'dedupeDigest',
  'dedupePrompt',
  'emphasisBlock',
  'FALSE_POSITIVES',
  'fixerPrompt',
  'fixReviewPrompt',
  'GAP_DESCRIPTION_BUDGET',
  'issueDescription',
  'KNOWN_OTHER_BUDGET',
  'KNOWN_OWN_BUDGET',
  'knownFindingsBlock',
  'OBJECTION_BUDGET',
  'objectionText',
  'partitionPrompt',
  'pinToReviewHead',
  'reviewerPrompt',
  'REVIEW_RULES',
  'ROUND_EMPHASIS',
  'roundEmphasis',
  'SEVERITY_RUBRIC',
  'surveyBlock',
  'surveyPrompt',
  'validatorPrompt',

  // Agent rosters and schemas.
  'ARCHITECTURAL_LENSES',
  'DEDUPE_SCHEMA',
  'FIX_RESULT_SCHEMA',
  'ISSUES_SCHEMA',
  'PARTITION_SCHEMA',
  'REVIEWERS',
  'REVIEW_RESULT_SCHEMA',
  'SEVERITY_ORDER',
  'SURVEY_SCHEMA',
  'VERDICT_SCHEMA',
];

// The script's declarations, evaluated against `args` — the config knobs are themselves derived from it.
export const internals = (args = {}) => loadInternals(SCRIPT, { names: INTERNALS, args });

// How a unit is named in a label and which files belong to it are the script's rules, and a fixture that re-derives
// them is a mirror free to drift — so borrow the two functions themselves. Loaded once, at module scope, because the
// fake agent answers synchronously.
const { fileInUnit, withUnitSlugs } = await internals();

// --- Label parsing --------------------------------------------------------------------------------------------------
// The script encodes which finding, revision attempt and vote an agent belongs to in its label, so a fake agent can
// answer per-finding from the label alone. Mirrors `findingTag` / `attemptTag` / `voteTag`.
const PER_FINDING = /^(fix|revise|review-fix|validate):(.+?)#(\d+)(?: attempt (\d+))?(?: vote (\d+)\/(\d+))?$/;

// Labels carry no round marker: one round is one invocation, so a `/workflows` tree holds a single round and the ` round
// k/n` suffix a looped run needed is gone. This used to strip it, and the strip was worth removing rather than keeping
// as insurance — a suffix that came back would land inside the last colon segment a review label is split into, reading
// as the category `bug round 2/4`, which matches no finding and routes nothing.
export function parseLabel(label = '') {
  const perFinding = PER_FINDING.exec(label);

  if (perFinding) {
    const [, kind, category, idx, attempt, vote] = perFinding;

    return {
      kind,
      category,
      idx: Number(idx),

      // `attemptTag` renders attempt N as "attempt N+1", and omits it entirely for the original attempt.
      attempt: attempt ? Number(attempt) - 1 : 0,
      vote: vote ? Number(vote) - 1 : 0,
    };
  }

  if (label.startsWith('review:')) {
    const [, unit, key] = label.split(':');

    // The architecture lenses are labelled `review:arch:<lens>` and all report a single category.
    return { kind: 'review', unit, key, category: unit === 'arch' ? 'architecture' : key };
  }

  if (label.startsWith('dedupe')) {
    return { kind: 'dedupe' };
  }

  return { kind: label };
}

// --- The finding a per-finding agent was actually asked about --------------------------------------------------------
// The label's index numbers the script's *own* list — the de-duplicated union `mergeIssueGroups` produces, numbered once
// and never renumbered afterwards, so `fix:bug#1` stays the finding `validate:bug#1` judged even though validation
// dropped some of its neighbours. It is therefore not an index into the `issues` a scenario supplied: one merge
// collapses two findings into one and shifts every later index left. Resolving `issues[idx]` answers about the wrong
// finding, silently, in exactly the tests that exercise merging.
//
// Every per-finding prompt embeds its subject as `Issue:\n<JSON>` (`validatorPrompt`, `fixerPrompt` and
// `fixReviewPrompt` all do), so reading it back out of the prompt is authoritative: an override sees the finding the
// script is really working on, merged severity and absorbed `otherSites` included. The closing brace anchors the match
// because `JSON.stringify(…, null, 2)` indents everything nested, leaving the top-level `}` the only one at column 0.
const ISSUE_BLOCK = /^Issue:\n(\{[\s\S]*?^\})$/m;

// A plausible reviewed HEAD, i.e. what the survey reports and every pin instruction has to carry.
export const HEAD = 'cd976db1f0a94c2f9b7e5d3a8c1e6f40b2d75a93';

// Deterministic 40-character hex object names. `Math.random` is unavailable to workflow scripts and would make failures
// irreproducible here too, so commit SHAs are derived from a seed.
export const commitSha = (seed) => `deadbeef${String(seed).slice(0, 32).padStart(32, '0')}`;

export const issue = (over = {}) => ({
  description: 'A validated finding',
  severity: 'high',
  category: 'bug',
  file: 'src/a.ts',
  lines: '10',
  reason: 'bug',
  ...over,
});

// The per-unit reviewer keys, so a scenario can hand each reviewer the findings that belong to it. A reviewer's
// category is stamped onto whatever it returns, so returning a 'security' issue from the 'bug' reviewer would silently
// relabel it and break every category-dependent expectation. Read off the script's own roster rather than copied, so a
// reviewer added or renamed there cannot leave a stale list here that quietly covers a reviewer that no longer exists.
export const REVIEWER_KEYS = (await internals()).REVIEWERS.map((reviewer) => reviewer.key);

const DEFAULT_SURVEY = {
  languages: ['TypeScript'],
  tooling: 'npm test',
  entryPoints: ['src/index.ts'],
  structure: [{ path: 'src', fileCount: 2 }],
};

/**
 * Build a fake agent for a `--fix` run.
 *
 * Overridable behaviours, each receiving the parsed label so it can answer per-finding. `issue` is read back out of the
 * prompt (see `ISSUE_BLOCK`), so it is the finding the script is working on and not `issues[idx]`, which the label's
 * index only agrees with while nothing has been merged or dropped:
 *
 *   review(call, { unit, key, category })     → ISSUES_SCHEMA shape
 *   fix(issue, { idx, attempt, call })        → FIX_RESULT_SCHEMA shape, or null for an agent that never returned
 *   reviewFix(issue, { idx, attempt, vote })  → REVIEW_RESULT_SCHEMA shape
 *   validate(issue, { idx, vote })            → VERDICT_SCHEMA shape
 *
 * `review` takes the raw `call` rather than the parsed label, so an override can read the prompt — which is where a
 * round's own inputs are, `knownFindingsBlock` and the emphasis included. It answers for the whole scope it was labelled
 * with: the unit routing `inUnit` performs for the default is the default's business, so an override is trusted to
 * return findings its unit could plausibly own.
 */
export function fixScenario({
  headSha = HEAD,
  issues = [issue()],
  exclusions = [],
  unitPaths,
  units,
  survey = {},
  // A repository that has a rulebook, since that is the ordinary case and the one the compliance reviewer is for. An
  // empty list is not a neutral default: it is the specific "no `CLAUDE.md` anywhere" case that drops that reviewer and
  // records a gap, which every unrelated test would then be asserting around.
  claudeMd = { paths: ['CLAUDE.md'] },
  headOnly,
  review,
  dedupe,
  fix,
  reviewFix,
  validate,
  // How the script narrows the roster the partition agent returned into the partition the reviewers are actually given.
  // Supplied by `runFix`, which knows the run's `args` and borrows the script's own `narrowToScope` for it. The
  // identity default is what a run with no `--path` does, which is every scenario built without one.
  scopeUnits = (roster) => roster,
} = {}) {
  // Validate coherence: if both issues and unitPaths are provided *and unitPaths will actually be used* (when units is
  // not provided), they must reference the same files. Otherwise reviewers will filter out issues whose files aren't in
  // unitPaths, causing the test to silently exercise an empty-review path instead of failing with a clear error.
  //
  // Only checked once some issue cites a file. A repo-wide finding cites none — an architecture lens reads the whole
  // repository rather than a unit's file list — so there is nothing for `unitPaths` to agree with, and it is not a
  // redundant restatement of the issues but the only way to put paths in scope at all: the derived `filesOf(issues)`
  // is empty by construction, and below three paths the lenses are skipped. Nothing is filtered out in that case, so
  // there is no silent empty review for this to catch.
  const issueFiles = filesOf(issues);

  if (!units && unitPaths && issueFiles.length > 0) {
    const unitPathsSet = new Set(unitPaths);
    const issueFilesSet = new Set(issueFiles);

    const pathsMismatch =
      unitPathsSet.size !== issueFilesSet.size || ![...unitPathsSet].every((path) => issueFilesSet.has(path));

    if (pathsMismatch) {
      throw new Error(
        `Incoherent scenario configuration: \`unitPaths\` (${JSON.stringify([...unitPathsSet].sort())}) ` +
          `does not match files referenced in \`issues\` (${JSON.stringify([...issueFilesSet].sort())}). ` +
          `Either omit \`unitPaths\` to derive it from \`issues\`, or ensure both reference the same files.`,
      );
    }
  }

  // Every fix result handed out, by finding index, so tests can assert against what the fixers actually claimed.
  const handedOut = new Map();
  const unmatched = [];

  // Prompts no `Issue:` block could be read out of. Collected rather than thrown, because a throw here reads as an
  // agent that died — `parallel()` resolves it to null — and would surface as a puzzling outcome rather than as the
  // prompt-shape change it is. `report` raises it once the run is over.
  const unreadable = [];

  // Agent labels naming a unit slug no roster entry answers to — an unrecognised slug is a broken fixture, not a wider
  // scope (see `inUnit`). Recorded as well as thrown because a reviewer runs under `parallel()`, where a throw resolves
  // to `null`, which would read as a unit that found nothing.
  const unroutable = [];

  // Every finding the script numbered, keyed by the number its labels carry. Validate runs once over the findings this
  // round contributed, so this ends a run holding one entry per finding that was *judged* — which is what lets
  // `outcomeAt` tell which of them validation then dropped. On a round given `knownFindings` it therefore holds less
  // than `findings`, deliberately: a finding the round was handed has no outcome of its own here to line up.
  const numbered = new Map();

  // The checks live with the state they guard, so every way of driving this fixture gets them: `runFix`, and a test that
  // composes `agent` with `runWorkflow` itself to pass args no wrapper can express. Registered on the test rather than
  // performed by a wrapper, because a wrapper can be bypassed — which is how these checks used to be forfeited: two of
  // the three lived in `runFix` alone, so the compose paths kept none of them. Building a scenario outside a test throws
  // here instead of quietly skipping them.
  //
  // Ordered cause before symptom: a reviewer whose scope could not be resolved returned null for that reason, and a
  // finding it then failed to report leaves labels behind that are only the consequence. Reported at most once, so that
  // `runFix` may raise them while its own run is still what failed without the teardown repeating what was already said.
  let reported = false;
  const report = () => {
    if (reported) return;

    reported = true;

    if (unroutable.length) {
      throw new Error([...new Set(unroutable)].join(' '));
    }

    if (unreadable.length) {
      throw new Error(
        `Could not read the \`Issue:\` block out of the prompt for: ${[...new Set(unreadable)].join(', ')}. A ` +
          'per-finding prompt no longer embeds its subject the way `ISSUE_BLOCK` expects, so the scenario cannot tell ' +
          'which finding it is being asked about — update the pattern to match the prompt.',
      );
    }

    if (unmatched.length) {
      throw new Error(
        `The scenario had no answer for agent label(s): ${[...new Set(unmatched)].join(', ')}. Teach ` +
          'fixScenario about them — an unanswered agent returns null, which quietly exercises a failure path.',
      );
    }
  };

  onTestFinished(report);

  // The partition the whole run is shaped by: one unit holding every finding unless a test says otherwise. Reviewers
  // are labelled per unit and dedupe is now scoped per unit, so both have to read the same roster.
  const roster = units ?? [{ name: 'core', summary: 'the code', paths: unitPaths ?? filesOf(issues) }];

  // The survey the run receives, hoisted out of the agent switch below because the partition narrowing needs it too: the
  // unit ceiling is a function of `inScopeFileCount`, so the fixture cannot mirror the script's roster without knowing
  // the same count the script will read. `survey === null` is a run whose survey fails, which aborts before the Partition
  // phase — nothing reaches the narrowing, so the shape handed to it there does not matter.
  const surveyResult =
    survey === null
      ? null
      : { ...DEFAULT_SURVEY, inScopeFileCount: (unitPaths ?? filesOf(issues)).length, headSha, ...survey };

  // A label carries the unit's *slug*, not the name the partition returned, so the roster is indexed by the slug the
  // script itself stamps on. A re-normalization matched on a prefix instead, which resolved `review:core:bug` to a
  // `core-utils` unit and missed both `unitSlug`'s camel-case split (`AuthMiddleware`) and `withUnitSlugs`' collision
  // suffixes (`wire-protocol-2`) — and a miss then read as "whole repository", handing every unit's findings back.
  //
  // Indexed over the *scoped* roster, because that is the one the reviewers get: under a `--path` scope the script
  // intersects every unit's paths with the requested subtrees and drops a unit the intersection emptied, both before
  // slugging. Routing by the raw roster instead would answer a reviewer about files it was never shown, and would
  // number repeated slugs off units the script discarded — resolving `wire-protocol` to a unit that never ran — in
  // neither case recording anything in `unroutable`, since the slug does exist on the roster the agent returned.
  const bySlug = new Map(withUnitSlugs(scopeUnits(roster, surveyResult)).map((unit) => [unit.slug, unit]));

  // An unrecognised slug is a broken fixture, not a wider scope, so say so — both to the caller and, for the case where
  // `parallel()` swallows the throw, to `unroutable` and the post-condition that reads it.
  const inUnit = (subject, slug) => {
    // The architecture lenses are labelled `review:arch:<lens>`, and a lens reads the whole repository, not a unit.
    if (slug === 'arch') return true;

    const unit = bySlug.get(slug);

    if (!unit) {
      const problem =
        `No unit on this scenario's roster is slugged '${slug}', so the fixture cannot tell which files the agent ` +
        `labelled with it was given. Slugs on the roster: ${[...bySlug.keys()].join(', ') || '(none)'}.`;

      unroutable.push(problem);

      throw new Error(problem);
    }

    return fileInUnit(subject.file, unit);
  };

  const subjectOf = (call) => {
    const [, json] = ISSUE_BLOCK.exec(call.prompt) || [];

    try {
      return JSON.parse(json);
    } catch {
      unreadable.push(call.label);

      return null;
    }
  };

  const defaultFix = (subject, { idx, attempt }) => ({
    status: 'applied',
    sha: commitSha(idx * 10 + attempt),
    branch: `rrfix/wf_test/${idx}${attempt ? `-r${attempt}` : ''}`,
    changedFiles: [subject.file],
    reason: 'fixed',
  });

  const agent = (call) => {
    const label = parseLabel(call.label);

    switch (label.kind) {
      case 'survey':
        return surveyResult;

      case 'claude-md-scan':
        return claudeMd;

      // The one-question re-ask the Fix phase falls back to when the survey dropped `headSha`. Defaults to failing, so
      // a test that removes `headSha` sees the refusal path unless it deliberately supplies a recovery.
      case 'review-head':
        return headOnly ?? null;

      case 'partition':
        return { units: roster, exclusions };

      // A reviewer only ever sees its own unit's files, so a finding in another unit is not its to report — handing it
      // back from every unit would make one defect look like several and put it in more than one dedupe scope.
      case 'review':
        return review
          ? review(call, label)
          : {
              issues: issues.filter((subject) => subject.category === label.category && inUnit(subject, label.unit)),
            };

      // Standing in for a real dedupe. The agent only reports which findings collide, so "no duplicates" is the whole
      // answer here: the script keeps the union in the order the reviewers produced it, which is the order the
      // per-finding labels index into. An override receives the `call`, whose `opts.effort` names the ladder rung — and
      // it may throw, which is how the real harness surfaces an agent killed by the no-progress watchdog.
      case 'dedupe':
        return (dedupe ?? (() => ({ groups: [] })))(call);

      case 'validate': {
        const subject = subjectOf(call);
        if (!subject) return null;

        numbered.set(label.idx, subject);

        return (validate ?? (() => ({ confirmed: true, rationale: 'confirmed' })))(subject, label);
      }

      case 'fix':
      case 'revise': {
        const subject = subjectOf(call);
        if (!subject) return null;
        const result = (fix ?? defaultFix)(subject, { ...label, call });
        handedOut.set(label.idx, result);

        return result;
      }

      case 'review-fix': {
        const subject = subjectOf(call);
        if (!subject) return null;
        return (reviewFix ?? (() => ({ approved: true, objection: '' })))(subject, label);
      }

      default:
        // Returning null keeps the run going, but an unanswered agent almost always means a new phase this scenario has
        // not been taught about — the post-condition registered above fails the test once the run is over.
        unmatched.push(call.label);

        return null;
    }
  };

  return { agent, unmatched, unroutable, unreadable, handedOut, numbered, report };
}

const filesOf = (issues) => [...new Set(issues.filter((subject) => subject.file).map((subject) => subject.file))];

/**
 * The steps the script performs on its way out of the Partition phase, under the args a run is given: narrow every
 * unit's paths to the requested scope, drop the units the narrowing emptied, then fold everything past the unit ceiling
 * into one bucket. The reviewers work from the result, so a fixture routing them by the roster the partition agent
 * returned would be answering for a scope they were never given — and, once the ceiling exists, would not recognise the
 * coalesced unit's slug at all. All three steps are borrowed from the script itself rather than re-derived here, so they
 * cannot drift from the enforcement they model — which is exactly what the scope-enforcement tests are asserting.
 *
 * Takes the survey the run will actually receive, because the ceiling is a function of the in-scope file count and the
 * script reads that count from the same place: a fixture that assumed the repository-sized default would mirror a
 * different ceiling than the one enforced.
 */
async function scopeUnitsFor(args) {
  const { narrowToScope, paths, coalesceToCeiling, unitCeiling, inScopeFiles } = await internals(args);

  return (roster, survey) => {
    const scoped = roster.map((unit) => ({ ...unit, paths: narrowToScope(unit?.paths) }));

    // With no `--path` an empty unit is a partitioner describing a scope it did not enumerate, which the script reviews
    // anyway; the drop is part of enforcing a requested scope, so it is conditional there too.
    const inScope = paths.length ? scoped.filter((unit) => unit.paths.length) : scoped;

    return coalesceToCeiling(inScope, unitCeiling(inScopeFiles(survey)));
  };
}

/**
 * Run a `--fix` review end to end. `validators` and `reviewers` are pinned to 1 so each finding gets one validator and
 * each fix one reviewer, rather than following the `auto` heuristics, which vary by category.
 */
export async function runFix({ args = {}, ...config } = {}) {
  const runArgs = { fix: true, reviewers: 1, validators: 1, ...args };
  const scenario = fixScenario({ ...config, scopeUnits: await scopeUnitsFor(runArgs) });
  const run = await runWorkflow({
    scriptPath: SCRIPT,
    args: runArgs,
    agent: scenario.agent,
  });

  // Raised from here as well as from the post-condition `fixScenario` registers, so that a fixture which could not tell
  // what it was asked about fails the run rather than only the teardown — the assertions below it would otherwise fail
  // first, on figures the diagnostic explains. It is the same check either way, and it speaks only once.
  scenario.report();

  return { ...run, scenario };
}

// Where each numbered finding's outcome sits in `fix.outcomes`. Validation filters the numbered findings without
// reordering or renumbering them (`verdicts.filter(Boolean)`), so the findings a run reports are that list's
// subsequence: walking both in step gives every outcome to the lowest-numbered finding still unclaimed that it matches.
// Matched on the serialised finding, which is what `numbered` holds — a JSON round-trip of it, read back out of the
// validator's prompt — so two findings that are genuinely identical are told apart by their order, the one thing the
// filter is guaranteed to preserve. Returns null if the two lists could not be lined up at all, which means the fixture
// has drifted from the script rather than that a finding was dropped.
const numberedSlots = (numbered, findings) => {
  const slots = new Map();
  let slot = 0;

  for (const idx of [...numbered.keys()].sort((left, right) => left - right)) {
    if (slot < findings.length && JSON.stringify(numbered.get(idx)) === JSON.stringify(findings[slot])) {
      slots.set(idx, slot++);
    }
  }

  return slot === findings.length ? slots : null;
};

// The per-finding outcome for finding `idx`, which is what most fix assertions are really about. `idx` is the script's
// numbering — the same one the labels carry, so it agrees with a `fix`/`reviewFix` override's `idx` — and not an index
// into the `issues` the scenario was given, which it parts ways with as soon as dedupe merges anything.
//
// It is not an index into `fix.outcomes` either. That list is positional over the findings that *survived* validation,
// while the numbering is stamped on the union validation was handed and is deliberately never revised, so that
// `fix:bug#1` stays the finding `validate:bug#1` judged. The two slide apart the moment a validator rejects something —
// with `bug#1` dropped, `bug#2`'s outcome sits in slot 1 — so indexing straight into `outcomes` would answer a test
// about `#1` with a different finding's outcome, and pass for the wrong reason. Resolve through the numbering instead,
// and refuse to answer for a finding validation dropped: it has no outcome, and its neighbour's is not a substitute.
export const outcomeAt = (run, idx) => {
  const numbered = run.scenario?.numbered;

  if (!numbered) {
    throw new Error(
      '`outcomeAt` needs the scenario the run was driven by, which `runFix` attaches as `run.scenario`; a run composed ' +
        'from `fixScenario` and `runWorkflow` has to pass it through, or read `run.result.fix.outcomes` directly.',
    );
  }

  const slots = numberedSlots(numbered, run.result.findings ?? []);

  if (!slots) {
    throw new Error(
      'The findings this run reported could not be lined up with the ones the fixture saw numbered at validation, so ' +
        `it cannot tell which outcome belongs to #${idx}: \`validatorPrompt\` no longer embeds the finding verbatim, ` +
        'or validation no longer preserves its order — update `numberedSlots` to match.',
    );
  }

  if (!slots.has(idx)) {
    const surviving = [...slots.keys()].map((survivor) => `#${survivor}`).join(', ');

    throw new Error(
      `The run reports no fix outcome for finding #${idx} — validation dropped it, and the findings it kept are ` +
        `${surviving || 'none at all'}. An outcome carries its finding's \`file\` / \`description\`, so assert on ` +
        'those when a test needs to say which finding it means.',
    );
  }

  return run.result.fix.outcomes[slots.get(idx)];
};
