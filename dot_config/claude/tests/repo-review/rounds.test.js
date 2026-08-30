/**
 * One round per invocation.
 *
 * `--loop` used to run the rounds inside the script: a `for` loop around Review, Dedupe, Validate and Fix, exiting when
 * a round added nothing. A four-round run of it consumed an entire session limit in 41 minutes and produced *nothing* —
 * Review and Validate are `parallel()` barriers, so a run killed in round 3 discards rounds 1 and 2 as well. Rounds are
 * the caller's loop now. Each invocation is one complete review that returns, gets reported and gets persisted, and the
 * wrapper decides whether to run another.
 *
 * That makes the round boundary a contract, and these are its terms. In: `round` and `knownFindings` on `args`. Out:
 * `findings` — everything the round was handed, plus what it confirmed — and `newFindings`, the count the caller stops
 * on. And the part that is not visible in the return value at all: a round re-judges nothing it was handed, because the
 * round that produced those findings already validated them; re-doing it is what made every round cost as much as the
 * whole review so far. `NEW_THIS_ROUND` is the mechanism, and `dedupe.test.js` covers the merge rule that makes the mark
 * trustworthy.
 */

import { describe, expect, it } from 'vitest';

import { issue, runReview, withFingerprints } from './scenario.js';

const held = [
  issue({ description: 'unchecked frame length', file: 'core/wire.py', lines: '132' }),
  issue({ description: 'partial read treated as EOF', file: 'core/frame.py', lines: '44' }),
];

const found = [issue({ description: 'the retry loop never terminates', file: 'core/frame.py', lines: '51' })];

// One unit spanning every file either list cites, so no finding lands in the unclaimed cross-cutting dedupe scope and
// every round below runs a single dedupe agent.
const units = [{ name: 'core', summary: 'the protocol', paths: ['core/wire.py', 'core/frame.py'] }];

const round = (args = {}, config = {}) =>
  runReview({ issues: found, units, args: { round: 2, knownFindings: held, ...args }, ...config });

describe('what a round returns', () => {
  it('hands back what it was given along with what it found', async () => {
    // The caller passes `findings` straight into the next round's `knownFindings`, so a round that returned only its own
    // findings would drop everything before it — the exact failure the in-script loop had, moved to the boundary.
    const run = await round();

    expect(run.result.findings.map((finding) => finding.description)).toEqual([
      'unchecked frame length',
      'partial read treated as EOF',
      'the retry loop never terminates',
    ]);
    expect(run.result.newFindings).toBe(1);
  });

  it('echoes the round it ran, so the caller is not counting on its own', async () => {
    // The round number appears in the report and in the ledger entry the wrapper writes, and it is also what selects the
    // emphasis the reviewers were actually given. Reading it back off the result rather than off the request means the
    // two cannot disagree — including when the request was unusable and the script fell back to 1.
    expect((await round({ round: 5 })).result.round).toBe(5);
    expect((await round({ round: 'later' })).result.round).toBe(1);
  });

  it('counts only what validation confirmed, not everything it found', async () => {
    // `newFindings` is a novelty signal *and* a stop condition, so a round whose one finding was rejected has not found
    // anything: counting it would keep the caller looping over a review that is producing nothing but false positives.
    const run = await round({}, { validate: () => ({ confirmed: false, rationale: 'not a defect' }) });

    expect(run.result.newFindings).toBe(0);
    expect(run.result.findings.map((finding) => finding.description)).toEqual([
      'unchecked frame length',
      'partial read treated as EOF',
    ]);
  });

  it('keeps a finding it was handed even though it never re-judged it', async () => {
    // A validator that rejects everything must not empty the accumulated set: the held findings were confirmed by the
    // round that found them and were deliberately not put through this gate again, so dropping them here would let one
    // round's stricter validators silently delete another round's confirmed work.
    const run = await round({}, { validate: () => ({ confirmed: false, rationale: 'not a defect' }) });

    expect(run.result.findings).toHaveLength(held.length);
  });
});

describe('what a round does not do again', () => {
  it('judges only what it found itself', async () => {
    // Validation is the second-largest fan-out in the run (`findings × --validators`). Judging the accumulated set every
    // round makes round 4 pay for rounds 1 through 3, which is most of what made a looped run unaffordable.
    const judged = (await round()).called(/^validate/);

    expect(judged).toHaveLength(1);
    expect(judged[0].prompt).toContain('the retry loop never terminates');
  });

  it('offers only what it found itself as new, so the next command is not asked to re-fix a held finding', async () => {
    // `newFindings` and `findings` are read by two different consumers, and this is the one place they disagree on
    // purpose. The wrapper stops looping on the count; `/repo-review-fix` selects out of the accumulated list but skips
    // what the ledger already records a branch for. Counting a held finding as new would keep the loop running over a
    // converged review, and each further round would spend a worktree, a fixer and a reviewer re-fixing what an earlier
    // round already has a branch for.
    const run = await round();

    expect(run.result.newFindings).toBe(1);
    expect(run.result.findings).toHaveLength(3);
  });

  it('spends nothing at all on a round that found nothing', async () => {
    // A round that raised nothing has nothing to merge against a settled set and nothing to judge, so it returns before
    // Dedupe rather than paying a pass to re-derive what it was handed.
    const run = await round({}, { review: () => ({ issues: [] }) });

    expect(run.called(/^dedupe/)).toHaveLength(0);
    expect(run.called(/^validate/)).toHaveLength(0);
    expect(run.result.newFindings).toBe(0);
    expect(run.result.findings).toEqual(withFingerprints(held));
    expect(run.logged('Round 2 produced no findings — the review is dry.')).toHaveLength(1);
  });
});

describe('a round that aborts', () => {
  // Every abort hands back what it was given. The caller writes `findings` straight into its ledger and into the next
  // round's `knownFindings`, so a round that aborted and reported nothing held would not merely lose its own work: it
  // would delete every round before it, the whole accumulated review destroyed by one Haiku agent that failed to answer.
  // Aborting means this round added nothing, which is `newFindings: 0` plus the gap — not that the review found nothing.
  //
  // Each case below is a separate `return` statement in the script rather than a shared exit, which is exactly why they
  // are asserted one at a time. Two of the three used to return `findings: []`, and the survey one carried no `round` and
  // no `newFindings` at all — leaving the wrapper's stop conditions reading `undefined` and its round counter `NaN`.
  const expectHeld = (run) => {
    expect(run.result.findings).toEqual(withFingerprints(held));
    expect(run.result.newFindings).toBe(0);
    expect(run.result.round).toBe(2);
    expect(run.result.gaps.join(' ')).toMatch(/review aborted/);
  };

  it('keeps what it was handed when the survey never returns', async () => {
    expectHeld(await round({}, { survey: null }));
  });

  it('keeps what it was handed when the partition returns no usable units', async () => {
    expectHeld(await round({}, { units: [] }));
  });

  it('keeps what it was handed when the whole partition falls outside the requested scope', async () => {
    expectHeld(await round({ paths: ['docs'] }));
  });
});

describe('a first round', () => {
  it('is a round that happens to hold nothing', async () => {
    // Round 1 is not a special case in the script, and this is the assertion that keeps it that way: with an empty
    // ledger every finding is new, so `newFindings` is the whole confirmed set and `findings` is the same list.
    const run = await runReview({ issues: [...held, ...found], units });

    expect(run.result.round).toBe(1);
    expect(run.result.findings).toHaveLength(3);
    expect(run.result.newFindings).toBe(3);
    expect(run.called(/^validate/)).toHaveLength(3);
  });
});
