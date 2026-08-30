/**
 * The validators' majority gate: whether a finding is real enough to report. A finding survives on a *strict* majority
 * of the validators that actually returned, so a tie drops it and a phase where nothing returned is a gap rather than a
 * silent pass — the asymmetry being that a reported finding costs a user's attention, and `/repo-review-fix` will spend
 * an Opus agent on it, while a dropped one costs a round.
 *
 * The Review phase's own gate is here for the same reason: a round with no findings only ends the review if the
 * reviewers actually came back, so a round where they all failed must not read as the review having gone dry.
 *
 * The gate on the other side of the ledger — fix reviewers deciding whether a commit should land — is the same strict
 * majority over the same `quorum` helper, and is pinned in `tests/repo-review-fix/review-gate.test.js`.
 */

import { describe, expect, it } from 'vitest';

import { runWorkflow } from '../harness.js';
import { issue, REVIEW_GROUP_KEYS, reviewScenario, runReview, SCRIPT, withFingerprints } from './scenario.js';

// How many review agents a one-unit round spends, read off the arm the run is in rather than written as a literal — the
// gap below counts agents, and `--reviewers-per-unit` is what decides how many the same roster becomes.
const AGENTS = REVIEW_GROUP_KEYS.length;

// Whether a reviewer was given to any agent this round. In the default arm the roster is grouped onto two agents, so a
// dropped reviewer is not a label that disappeared — the agent still runs, one axis lighter — and the only place the
// difference shows is the prompt. Keyed on the roster's `title`, which both arms' prompts render verbatim.
const axesReviewed = (run) =>
  run
    .called(/^review:core:/)
    .map((call) => call.prompt)
    .join('\n');

// A review in which the reviewers `dropReview` names never return; every other phase keeps the defaults. Composed from
// `reviewScenario` and `runWorkflow` directly, rather than going through `runReview`, because the drop is keyed off the
// label of the call rather than off the finding — which is what "reviewer #3 died" means and what no override can say.
const reviewRun = ({ dropReview = () => false, args = {}, ...config } = {}) => {
  const scenario = reviewScenario(config);

  return runWorkflow({
    scriptPath: SCRIPT,
    args,
    agent: (call) => (call.label.startsWith('review:') && dropReview(call.label) ? null : scenario.agent(call)),
  });
};

describe('a review round in which every reviewer fails', () => {
  it('is reported as nothing reviewed rather than nothing found', async () => {
    // A collapsed round 1 leaves the same empty `findings` list a clean repository would, which the wrapper renders as
    // "No issues found". The per-reviewer "did not complete" gaps do not correct that: one at a time they read as
    // partial coverage rather than as a review that never happened.
    const run = await reviewRun({ dropReview: () => true });

    expect(run.result.findings).toEqual([]);
    expect(run.result.gaps.join(' ')).toContain(`All ${AGENTS} reviewer(s) in round 1 failed to return`);
    expect(run.logged('produced no findings')).toHaveLength(0);
  });

  it('does not let a later round tell the caller the review has gone dry', async () => {
    // A round whose reviewers all failed returns `newFindings: 0`, which is the very signal the caller stops looping on
    // — so on a later round the gap is the only thing separating "nothing left to find" from "nobody looked". It has to
    // survive the early return an empty round takes, and the findings the round was handed have to come back with it,
    // or a collapsed round 4 would also discard rounds 1 through 3.
    const held = [issue({ description: 'held from an earlier round' })];
    const run = await reviewRun({ args: { round: 2, knownFindings: held }, dropReview: () => true });

    expect(run.result.findings).toEqual(withFingerprints(held));
    expect(run.result.newFindings).toBe(0);
    expect(run.result.gaps.join(' ')).toContain(`All ${AGENTS} reviewer(s) in round 2 failed to return`);
    expect(run.logged('Round 2 produced no findings')).toHaveLength(0);
  });

  it('still reads a round the reviewers returned empty as the review going dry', async () => {
    const run = await reviewRun({ issues: [] });

    expect(run.result.gaps.join(' ')).not.toContain('failed to return');
    expect(run.logged('Round 1 produced no findings').length).toBe(1);
  });
});

describe('CLAUDE.md scan', () => {
  it('records a gap when the scan does not return, but continues the review', async () => {
    // The CLAUDE.md scan returning null is a degraded-but-functional path: the compliance reviewers run without a
    // governing-file list, but the review continues rather than aborting.
    const run = await runReview({ claudeMd: null });

    expect(run.result.gaps.join(' ')).toContain('`CLAUDE.md` scan did not return');
    expect(run.result.gaps.join(' ')).toContain('compliance reviewers ran without a governing-file list');

    // The review should proceed and produce findings despite the missing scan.
    expect(run.result.findings).toHaveLength(1);

    // A failed scan leaves the list *unknown*, not known-empty, so the reviewer still runs and reads the files itself —
    // the opposite of the case below, and the reason the two cannot share one branch.
    expect(axesReviewed(run)).toContain('CLAUDE.md compliance');
    expect(run.result.gaps.join(' ')).not.toContain('compliance not reviewed');
  });

  it('drops the compliance reviewer, and says so, when the scan finds no `CLAUDE.md` at all', async () => {
    // A compliance reviewer with an empty rulebook can only return nothing or invent a convention to judge against,
    // and one Sonnet agent per unit is spent either way. Skipping it is only safe if the skip is recorded: an empty
    // `findings` list is what a clean audit returns too, so an unrecorded skip reads as "`CLAUDE.md` compliance: clean"
    // in the wrapper's report.
    const run = await runReview({ claudeMd: { paths: [] } });

    expect(axesReviewed(run)).not.toContain('CLAUDE.md compliance');
    expect(run.result.gaps.join(' ')).toContain('`CLAUDE.md` compliance not reviewed');
    expect(run.result.gaps.join(' ')).toContain('contains no `CLAUDE.md` file to audit against');

    // Only that reviewer is dropped: the rest of the roster still runs, and the round is not read as a failed one. In the
    // default arm that costs no agent at all — the Sonnet group runs one axis lighter — which is why the count here is
    // the arm's full agent count rather than one less than it.
    expect(run.called(/^review:core:/)).toHaveLength(AGENTS);
    expect(run.result.gaps.join(' ')).not.toContain('failed to return');
    expect(run.result.findings).toHaveLength(1);
  });
});

describe('validation', () => {
  it('drops a finding that only half its validators confirm', async () => {
    // 1-of-2 is not a majority. Keeping it would put an unconfirmed finding in front of a fix agent.
    const run = await runReview({ args: { validators: 2 }, validate: (subject, { vote }) => ({
      confirmed: vote === 0,
      rationale: 'split',
    }) });

    expect(run.called(/^validate:/)).toHaveLength(2);
    expect(run.result.findings).toEqual([]);
  });

  it('keeps a finding two of three validators confirm', async () => {
    const run = await runReview({ args: { validators: 3 }, validate: (subject, { vote }) => ({
      confirmed: vote !== 2,
      rationale: 'mostly agreed',
    }) });

    expect(run.result.findings).toHaveLength(1);
  });

  it('drops a finding that only 2-of-4 validators confirm', async () => {
    // 2-of-4 = 50%, which is not a strict majority (needs >50%). Another tie configuration.
    const run = await runReview({ args: { validators: 4 }, validate: (subject, { vote }) => ({
      confirmed: vote < 2,
      rationale: 'evenly split',
    }) });

    expect(run.called(/^validate:/)).toHaveLength(4);
    expect(run.result.findings).toEqual([]);
  });

  it('keeps a finding that 3-of-4 validators confirm', async () => {
    // 3-of-4 = 75%, which is a strict majority. Confirms the rule works above the threshold.
    const run = await runReview({ args: { validators: 4 }, validate: (subject, { vote }) => ({
      confirmed: vote < 3,
      rationale: 'strong majority',
    }) });

    expect(run.result.findings).toHaveLength(1);
  });

  it('drops a finding that only 3-of-6 validators confirm', async () => {
    // 3-of-6 = 50%, which is not a strict majority. Another even-split tie.
    const run = await runReview({ args: { validators: 6 }, validate: (subject, { vote }) => ({
      confirmed: vote < 3,
      rationale: 'evenly split',
    }) });

    expect(run.called(/^validate:/)).toHaveLength(6);
    expect(run.result.findings).toEqual([]);
  });

  it('keeps a finding that 4-of-6 validators confirm', async () => {
    // 4-of-6 = 66.7%, which is a strict majority. Confirms the rule works for larger pools.
    const run = await runReview({ args: { validators: 6 }, validate: (subject, { vote }) => ({
      confirmed: vote < 4,
      rationale: 'clear majority',
    }) });

    expect(run.result.findings).toHaveLength(1);
  });

  it('records a gap when no validator returns, rather than dropping the finding quietly', async () => {
    // The gap is the only surviving trace of this finding: it is in no other list, so it has to name the site the way
    // every other list does, and stay on one line — `gaps` is rendered as a bullet list, and reviewer prose routinely
    // arrives with newlines in it.
    const run = await runReview({
      issues: [issue({ description: 'first line\n\nsecond line', file: 'core/wire.py', lines: '10-20' })],
      validate: () => null,
    });

    expect(run.result.findings).toEqual([]);

    const gap = run.result.gaps.find((entry) => entry.startsWith('Validation did not complete'));

    expect(gap).toContain('core/wire.py:10-20');
    expect(gap).toContain('first line second line');
    expect(gap).not.toContain('\n');
  });

  it('scales validators by category when set to auto', async () => {
    // High-risk categories (architecture, bug, consistency, security) get 3 validators, others get 1.
    const run = await runReview({
      args: { validators: 'auto' },
      issues: [
        issue({ file: 'src/a.ts', description: 'high-risk bug', category: 'bug' }),
        issue({ file: 'src/b.ts', description: 'code quality issue', category: 'code-quality' }),
        issue({ file: 'src/c.ts', description: 'security issue', category: 'security' }),
        issue({ file: 'src/d.ts', description: 'test critique', category: 'test-critique' }),
      ],
      validate: () => ({ confirmed: true, rationale: 'valid' }),
    });

    const validators = run.called(/^validate:/);
    // Bug (high-risk): 3 validators, code-quality (low-risk): 1, security (high-risk): 3, test-critique (low-risk): 1
    // Total: 3 + 1 + 3 + 1 = 8 validators
    expect(validators).toHaveLength(8);

    // Matched on the category alone rather than on `<category>#<idx>`. The index is a position in the round's deduplicated
    // union, and that order follows the order the reviewers returned in — which the default arm changes, since one agent
    // returns `bug` and `security` together before another returns `code-quality` and `test-critique`. What this test is
    // about is how many validators a category buys, and pinning the position as well made it also assert an arrangement
    // that `--reviewers-per-unit` is free to change.
    const forCategory = (category) => validators.filter((call) => call.label.includes(`${category}#`));

    expect(forCategory('bug')).toHaveLength(3);
    expect(forCategory('code-quality')).toHaveLength(1);
    expect(forCategory('security')).toHaveLength(3);
    expect(forCategory('test-critique')).toHaveLength(1);

    expect(run.result.findings).toHaveLength(4);
  });

  it('applies majority vote correctly with auto-scaling and partial validator failures', async () => {
    // High-risk findings get 3 validators, low-risk get 1. When some validators fail, the majority vote should still
    // work correctly based on the validators that actually returned.
    const run = await runReview({
      args: { validators: 'auto' },
      issues: [
        issue({ file: 'src/a.ts', description: 'security flaw', category: 'security' }), // High-risk: 3 validators
        issue({ file: 'src/b.ts', description: 'another bug', category: 'bug' }), // High-risk: 3 validators
        issue({ file: 'src/c.ts', description: 'code quality', category: 'code-quality' }), // Low-risk: 1 validator
      ],
      validate: (subject, { vote }) => {
        const label = subject.category;
        // Security finding (index 0): validator #1 fails, validators #0 and #2 both confirm
        // 2 > 2/2 is true, so the finding is kept.
        if (label === 'security') {
          if (vote === 1) return null;
          return { confirmed: true, rationale: 'valid security issue' };
        }
        // Bug finding (index 1): validator #1 fails, validator #0 confirms, validator #2 rejects
        // 1 > 2/2 is false, so the finding is dropped.
        if (label === 'bug') {
          if (vote === 1) return null;
          return { confirmed: vote === 0, rationale: vote === 0 ? 'yes' : 'no' };
        }
        // Code-quality finding (index 2): single validator confirms
        return { confirmed: true, rationale: 'valid' };
      },
    });

    const validators = run.called(/^validate:/);
    // Security: 3, bug: 3, code-quality: 1 = 7 total
    expect(validators).toHaveLength(7);

    // Security finding kept (2 of 2 confirmed), bug finding dropped (1 of 2 confirmed), code-quality kept (1 of 1 confirmed)
    expect(run.result.findings).toHaveLength(2);
    const categories = run.result.findings.map(f => f.category);
    expect(categories).toContain('security');
    expect(categories).toContain('code-quality');
    expect(categories).not.toContain('bug');
  });

  it('drops a finding when only 1 of 2 validators return and confirms (partial validator failure)', async () => {
    // Three validators configured, but validator #1 throws. Of the 2 that returned, only 1 confirms.
    // 1 > 2/2 is false, so the finding is dropped. This defensive behavior prevents an insufficiently-validated
    // finding from reaching a fix agent.
    const run = await runReview({ args: { validators: 3 }, validate: (subject, { vote }) => {
      if (vote === 1) return null; // Simulates parallel() catching a throw and returning null.
      return { confirmed: vote === 0, rationale: vote === 0 ? 'yes' : 'no' };
    } });

    expect(run.called(/^validate:/)).toHaveLength(3);
    expect(run.result.findings).toEqual([]);
  });

  it('keeps a finding when 2 of 2 validators return and both confirm (partial validator failure)', async () => {
    // Three validators configured, but validator #1 throws. Of the 2 that returned, both confirm.
    // 2 > 2/2 is true, so the finding is kept.
    const run = await runReview({ args: { validators: 3 }, validate: (subject, { vote }) => {
      if (vote === 1) return null;
      return { confirmed: true, rationale: 'yes' };
    } });

    expect(run.called(/^validate:/)).toHaveLength(3);
    expect(run.result.findings).toHaveLength(1);
  });
});

describe('survey', () => {
  it('aborts the review with a gap when the survey agent does not return', async () => {
    // The survey is a barrier phase — without repository context, no other phase can proceed. When it fails, the script
    // must abort cleanly rather than continuing with undefined values several phases later.
    const run = await runReview({ survey: null });

    expect(run.result.findings).toEqual([]);
    expect(run.result.exclusions).toEqual([]);
    expect(run.result.gaps.join(' ')).toContain('Survey agent did not return');
  });
});

