/**
 * The adjudication majority gate: whether a finding is real enough to report. A finding survives on a *strict* majority
 * of the adjudicators that actually voted on it, so a tie drops it and a finding nothing voted on is a gap rather than a
 * silent pass — the asymmetry being that a reported finding costs a user's attention, and `/repo-review-fix` will spend
 * an Opus agent on it, while a dropped one costs a round.
 *
 * What a vote *is* changed when validation fused into adjudication, and the arithmetic did not. There used to be one
 * agent per finding per vote, so a panel of three was three agents judging one finding. A panel of three is now three
 * agents each judging the whole scope, and the quorum is taken per finding over whichever of them answered about it. So
 * every case below is written as "n votes on this finding", and the fixture's `validate` hook — one call per finding per
 * panel member — is the seam that keeps that readable.
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

describe('adjudication', () => {
  // A run whose one finding is voted on by a panel of `panel` adjudicators, `confirmed` deciding each member's vote from
  // its index. Returning `null` from `confirmed` is that member leaving this finding out of its answer, which is what a
  // panel member that failed amounts to from the gate's point of view — the vote is simply not there to be counted.
  const votes = (panel, confirmed) =>
    runReview({ args: { validators: panel }, validate: (subject, { vote }) => {
      const yes = confirmed(vote);

      return yes === null ? null : { confirmed: yes, rationale: `vote ${vote}` };
    } });

  // How many adjudicators the round actually spawned. The panel is per scope now, so this is the panel size itself
  // rather than `findings × validators` — and asserting it is what catches a panel that silently collapsed to one, which
  // no verdict assertion can see when every member votes the same way.
  const panelSize = (run) => run.called(/^adjudicate:/).length;

  it('drops a finding that only half its panel confirms', async () => {
    // 1-of-2 is not a majority. Keeping it would put an unconfirmed finding in front of a fix agent.
    const run = await votes(2, (vote) => vote === 0);

    expect(panelSize(run)).toBe(2);
    expect(run.result.findings).toEqual([]);
  });

  it('keeps a finding two of three adjudicators confirm', async () => {
    const run = await votes(3, (vote) => vote !== 2);

    expect(panelSize(run)).toBe(3);
    expect(run.result.findings).toHaveLength(1);
  });

  it('drops a finding that only 2-of-4 adjudicators confirm', async () => {
    // 2-of-4 = 50%, which is not a strict majority (needs >50%). Another tie configuration.
    const run = await votes(4, (vote) => vote < 2);

    expect(panelSize(run)).toBe(4);
    expect(run.result.findings).toEqual([]);
  });

  it('keeps a finding that 3-of-4 adjudicators confirm', async () => {
    // 3-of-4 = 75%, which is a strict majority. Confirms the rule works above the threshold.
    const run = await votes(4, (vote) => vote < 3);

    expect(run.result.findings).toHaveLength(1);
  });

  it('drops a finding that only 3-of-6 adjudicators confirm', async () => {
    // 3-of-6 = 50%, which is not a strict majority. Another even-split tie.
    const run = await votes(6, (vote) => vote < 3);

    expect(panelSize(run)).toBe(6);
    expect(run.result.findings).toEqual([]);
  });

  it('keeps a finding that 4-of-6 adjudicators confirm', async () => {
    // 4-of-6 = 66.7%, which is a strict majority. Confirms the rule works for larger pools.
    const run = await votes(6, (vote) => vote < 4);

    expect(run.result.findings).toHaveLength(1);
  });

  it('records a gap when no adjudicator votes on a finding, rather than dropping it quietly', async () => {
    // The gap is the only surviving trace of this finding: it is in no other list, so it has to name the site the way
    // every other list does, and stay on one line — `gaps` is rendered as a bullet list, and reviewer prose routinely
    // arrives with newlines in it.
    const run = await runReview({
      issues: [issue({ description: 'first line\n\nsecond line', file: 'core/wire.py', lines: '10-20' })],
      validate: () => null,
    });

    expect(run.result.findings).toEqual([]);

    const gap = run.result.gaps.find((entry) => entry.startsWith('Adjudication did not complete'));

    expect(gap).toContain('core/wire.py:10-20');
    expect(gap).toContain('first line second line');
    expect(gap).not.toContain('\n');
  });

  it('scales the panel by risk when set to auto, over the scope rather than the finding', async () => {
    // `auto` used to be read per finding: a high-risk category bought 3 validators and a low-risk one bought 1, so this
    // scope cost 3 + 1 + 3 + 1 = 8 agents. The panel is per scope now, so the question is per scope too — does anything
    // here need the redundant read? — and the answer rounds *upward*: one high-risk finding buys three adjudicators and
    // the low-risk findings sharing the unit are judged three times for nothing extra, because those agents were reading
    // the whole scope regardless. Three agents in place of eight, and every finding judged at least as many times as
    // before.
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

    expect(run.called(/^adjudicate:/)).toHaveLength(3);
    expect(run.result.findings).toHaveLength(4);

    // Every finding really was put to all three, which is the half of the rounding that has to hold for the saving to be
    // a saving: a scope whose panel was three but whose low-risk findings were shown to one of them would be cheaper
    // still and would have quietly narrowed the gate.
    const asked = run.called(/^adjudicate:/).map((call) => call.prompt);

    for (const file of ['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/d.ts']) {
      expect(asked.filter((prompt) => prompt.includes(file))).toHaveLength(3);
    }

    // And a scope with nothing high-risk in it still buys one, which is what makes the rounding a rounding rather than a
    // flat three.
    const cheap = await runReview({
      issues: [issue({ file: 'src/a.ts', description: 'nit', category: 'code-quality' })],
      args: { validators: 'auto' },
    });

    expect(cheap.called(/^adjudicate:/)).toHaveLength(1);
  });

  it('takes the quorum per finding, so one panel decides several findings differently', async () => {
    // The gate is per finding and the panel is per scope, so one adjudicator's answer carries a verdict on each of
    // several findings and a member that omitted one has not abstained on the others. That is what makes this arithmetic
    // reachable at all: the same three agents produce a 2-of-2 pass, a 1-of-2 tie and a 1-of-1 pass in one run.
    const run = await runReview({
      args: { validators: 3 },
      issues: [
        issue({ file: 'src/a.ts', description: 'security flaw', category: 'security' }),
        issue({ file: 'src/b.ts', description: 'another bug', category: 'bug' }),
        issue({ file: 'src/c.ts', description: 'code quality', category: 'code-quality' }),
      ],
      validate: (subject, { vote }) => {
        // Member #1 stays silent about everything except the last finding, so the first two are decided 2-of-2 and
        // 1-of-2 while the third is decided by it alone.
        if (subject.category === 'code-quality') return vote === 1 ? { confirmed: true, rationale: 'yes' } : null;
        if (vote === 1) return null;
        if (subject.category === 'security') return { confirmed: true, rationale: 'yes' };

        return { confirmed: vote === 0, rationale: vote === 0 ? 'yes' : 'no' };
      },
    });

    expect(run.called(/^adjudicate:/)).toHaveLength(3);

    // Security: 2 of 2 confirmed, so kept. Bug: 1 of 2, which is not a strict majority, so dropped. Code-quality: 1 of
    // 1, so kept — a single vote is a majority of the votes cast, and a finding one agent judged is not a gap.
    expect(run.result.findings.map((finding) => finding.category).sort()).toEqual(['code-quality', 'security']);
    expect(run.result.gaps.filter((gap) => gap.startsWith('Adjudication did not complete'))).toEqual([]);
  });

  it('drops a finding when only 1 of 2 votes cast confirms it', async () => {
    // Three adjudicators, but member #1 leaves this finding out. Of the 2 votes cast, only 1 confirms: 1 > 2/2 is false,
    // so the finding is dropped. This is what keeps an insufficiently-judged finding away from a fix agent.
    const run = await votes(3, (vote) => (vote === 1 ? null : vote === 0));

    expect(panelSize(run)).toBe(3);
    expect(run.result.findings).toEqual([]);
  });

  it('keeps a finding when both votes cast confirm it', async () => {
    // The same panel, and member #1 is silent again, but the 2 votes cast both confirm: 2 > 2/2 is true.
    const run = await votes(3, (vote) => (vote === 1 ? null : true));

    expect(panelSize(run)).toBe(3);
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

