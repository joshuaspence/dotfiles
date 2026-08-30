/**
 * Scenario fixtures for `repo-review-fix.js`.
 *
 * Much smaller than the review's equivalent, and for a reason worth stating: this script has one agent between its
 * arguments and its fixers (the survey), where the review had five phases of them. A test about a fix branch supplies a
 * survey and a fix result and is done — there is no partition to mirror, no unit routing to get right, and no dedupe or
 * validation sliding the finding numbers out from under the labels.
 *
 * That last one is why there is no `outcomeAt` here. The review numbered findings over a list validation then filtered,
 * so a label's index and an outcome's position parted ways and had to be reconciled; here `outcomes` is positional over
 * the same `selected` list the labels are numbered from, so `run.result.outcomes[idx]` is simply finding `#idx`.
 */

import { onTestFinished } from 'vitest';

import { loadInternals, runWorkflow, workflowScript } from '../harness.js';

// Resolved by name from the workflow source directory, so this is the only place the script under test is identified.
export const SCRIPT = workflowScript('repo-review-fix');

// The internals these tests examine. Named explicitly rather than discovered: renaming one should fail here loudly
// instead of quietly dropping whatever it used to cover. Only internals a test actually reads belong here — a name no
// test touches is covering nothing, so listing it would just make renaming a private helper fail every suite that
// imports this fixture.
const INTERNALS = [
  // The content-addressed name a finding keeps across commands, and the copy of it this script has to hold because a
  // workflow script cannot import one. `parity.test.js` is what makes the copy safe.
  'fingerprint',
  'fingerprintKey',
  'withFingerprint',
  'HIGH_RISK',

  // The two caps and the ordering they select through.
  'DEFAULT_MAX_FIXES',
  'maxFixes',
  'severityFloor',
  'severityRank',
  'SEVERITY_ORDER',
  'selected',

  // Argument handling and the config knobs derived from it.
  'capEffort',
  'effort',
  'EFFORT_ORDER',
  'leafEffort',
  'reviewers',

  // Untrusted-input guards.
  'fullCommitSha',
  'isSandboxBranch',
  'isSafeRepoPath',

  // Prompt builders and the label grammar every per-finding agent is keyed off.
  'attemptTag',
  'driftBlock',
  'findingTag',
  'fixerPrompt',
  'fixReviewPrompt',
  'pinToBase',
  'READ_ONLY_RULE',
  'surveyPrompt',
  'voteTag',

  // Schemas and the statuses that are not in one.
  'FIX_RESULT_SCHEMA',
  'REVIEW_RESULT_SCHEMA',
  'STATUS_RESOLVED_ELSEWHERE',
  'STATUS_REVIEW_REJECTED',
  'SURVEY_SCHEMA',
];

// The script's declarations, evaluated against `args` — the caps are themselves derived from it.
export const internals = (args = {}) => loadInternals(SCRIPT, { names: INTERNALS, args });

const { withFingerprint } = await internals();

/**
 * The findings a scenario handed in, as the run reports them back: every finding is stamped with a `fingerprint` on the
 * way in, so a test comparing what came back against its own fixtures has to account for it. Borrowed from the script
 * rather than recomputed here, so changing the hash does not require a new expected value in every suite.
 */
export const withFingerprints = (issues) => issues.map(withFingerprint);

// The commit the fixes are based on — what the survey reports as `headSha` — and the older commit the findings were
// written against. Deliberately different, since that is the ordinary case for this command and the one the drift note
// exists for; a test about the no-drift case passes them equal.
export const HEAD = 'cd976db1f0a94c2f9b7e5d3a8c1e6f40b2d75a93';
export const REVIEWED = '4f1c0a77e2b9d84c6a35f0e1b8d72c94a6053fbe';

// Deterministic 40-character hex object names. `Math.random` is unavailable to workflow scripts and would make failures
// irreproducible here too, so commit SHAs are derived from a seed.
export const commitSha = (seed) => `deadbeef${String(seed).slice(0, 32).padStart(32, '0')}`;

export const issue = (over = {}) => ({
  description: 'A validated finding',
  severity: 'high',
  category: 'bug',
  file: 'src/a.ts',
  lines: '10',
  ...over,
});

// Every per-finding prompt embeds its subject as `Issue:\n<JSON>` (`fixerPrompt` and `fixReviewPrompt` both do), so
// reading it back out of the prompt is authoritative: an override sees the finding the script is really working on,
// fingerprint and narrowed `otherSites` included. The closing brace anchors the match because
// `JSON.stringify(…, null, 2)` indents everything nested, leaving the top-level `}` the only one at column 0.
const ISSUE_BLOCK = /^Issue:\n(\{[\s\S]*?^\})$/m;

/**
 * The finding a per-finding prompt is about, read back out of the prompt itself. Exported because assertions about
 * *which* findings a run chose to work on are assertions about the prompts it sent — the label carries only a category
 * and an index, which cannot distinguish two findings of the same category. Throws rather than returning null, since a
 * test reaching for a subject that is not there wants to fail on the prompt shape, not on a downstream `undefined`.
 */
export function promptIssue(prompt = '') {
  const [, json] = ISSUE_BLOCK.exec(prompt) || [];

  if (!json) throw new Error(`No \`Issue:\` block in prompt: ${prompt.slice(0, 200)}`);

  return JSON.parse(json);
}

const PER_FINDING = /^(fix|revise|review-fix):(.+?)#(\d+)(?: attempt (\d+))?(?: vote (\d+)\/(\d+))?$/;

export function parseLabel(label = '') {
  const perFinding = PER_FINDING.exec(label);

  if (!perFinding) return { kind: label };

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

/**
 * A clean fix: a commit on the branch the fixer was told to create, touching the file the finding cited. This is what an
 * un-overridden `fix` returns, and it is exported so that a test overriding `fix` for *one* finding can hand the others
 * the ordinary answer — returning `undefined` from an override would instead be an agent that never returned, which is a
 * different scenario with its own gap.
 */
export const appliedFix = (subject, { idx, attempt = 0 } = {}) => ({
  status: 'applied',
  sha: commitSha(idx * 10 + attempt),
  branch: `rrfix/wf_test/${idx}${attempt ? `-r${attempt}` : ''}`,
  changedFiles: [subject.file],
  reason: 'fixed',
});

const DEFAULT_SURVEY = {
  languages: ['TypeScript'],
  tooling: 'npm run typecheck && npm test',
  entryPoints: ['src/index.ts'],
};

/**
 * Build a fake agent for a fix run.
 *
 * Overridable behaviours, each receiving the parsed label so it can answer per-finding. `issue` is read back out of the
 * prompt (see `ISSUE_BLOCK`), so it is the finding the script is working on:
 *
 *   fix(issue, { idx, attempt, call })        → FIX_RESULT_SCHEMA shape, or null for an agent that never returned
 *   reviewFix(issue, { idx, attempt, vote })  → REVIEW_RESULT_SCHEMA shape
 *
 * `survey: null` is a survey that never returned, which is the run's one abort path; `survey: { headSha: '' }` is the
 * more interesting half of it — an agent that answered without the one field the whole run is pinned to. A `survey`
 * *function* answers the call itself, and may throw: that is how the harness represents an agent the no-progress
 * watchdog killed, and the survey is the one agent here whose throw would otherwise escape the workflow.
 */
export function fixScenario({ headSha = HEAD, survey = {}, fix, reviewFix } = {}) {
  // Every fix result handed out, by finding index, so tests can assert against what the fixers actually claimed.
  const handedOut = new Map();
  const unmatched = [];

  // Prompts no `Issue:` block could be read out of. Collected rather than thrown, because a throw here reads as an
  // agent that died — `parallel()` resolves it to null — and would surface as a puzzling outcome rather than as the
  // prompt-shape change it is. `report` raises it once the run is over.
  const unreadable = [];

  // The checks live with the state they guard, so every way of driving this fixture gets them: `runFix`, and a test that
  // composes `agent` with `runWorkflow` itself to pass args no wrapper can express. Reported at most once, so that
  // `runFix` may raise them while its own run is still what failed without the teardown repeating what was already said.
  let reported = false;
  const report = () => {
    if (reported) return;

    reported = true;

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

  const surveyResult = survey === null ? null : { ...DEFAULT_SURVEY, headSha, ...survey };

  const subjectOf = (call) => {
    const [, json] = ISSUE_BLOCK.exec(call.prompt) || [];

    try {
      return JSON.parse(json);
    } catch {
      unreadable.push(call.label);

      return null;
    }
  };

  const defaultFix = (subject, label) => appliedFix(subject, label);

  const agent = (call) => {
    const label = parseLabel(call.label);

    switch (label.kind) {
      case 'survey':
        return typeof survey === 'function' ? survey(call) : surveyResult;

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

  return { agent, unmatched, unreadable, handedOut, report };
}

/**
 * Run a fix end to end. `reviewers` is pinned to 1 so each fix gets one reviewer, and `findings` defaults to a single
 * finding — the smallest run that reaches the Fix phase at all.
 */
export async function runFix({ args = {}, ...config } = {}) {
  const runArgs = { findings: [issue()], reviewers: 1, reviewedCommit: REVIEWED, ...args };
  const scenario = fixScenario(config);
  const run = await runWorkflow({ scriptPath: SCRIPT, args: runArgs, agent: scenario.agent });

  // Raised from here as well as from the post-condition `fixScenario` registers, so that a fixture which could not tell
  // what it was asked about fails the run rather than only the teardown — the assertions below it would otherwise fail
  // first, on figures the diagnostic explains. It is the same check either way, and it speaks only once.
  scenario.report();

  return { ...run, scenario };
}
