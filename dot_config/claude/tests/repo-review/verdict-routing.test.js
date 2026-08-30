/**
 * Which finding a verdict lands on.
 *
 * There used to be one validator per finding, so this question answered itself: the agent was handed one finding and its
 * answer was about that one. An adjudicator is handed a whole scope and returns verdicts keyed by `index` — the number
 * the finding carries in the list it was shown — which makes the routing a thing the script computes and can therefore
 * get wrong.
 *
 * It gets wrong quietly, which is why this file exists. A misrouted verdict does not fail: it confirms one real defect
 * under another real defect's evidence and drops a third, and the report that comes out is a plausible report. Two
 * translations stand between an agent's answer and a mark on a finding — chunk-local index to scope index, and scope to
 * the round's concatenated union — and the second is the one that used to be pinned here, back when it was a label
 * number a reader matched a `validate:bug#7` row against.
 *
 * `/repo-review-fix` numbers its own sandbox branches (`rrfix/<RUN>/<n>`) over the findings it selected out of the
 * ledger, which is the same class of invariant on the other side of the split; it is pinned in
 * `tests/repo-review-fix/base-pinning.test.js` and `tests/repo-review-fix/branches.test.js`.
 */

import { describe, expect, it } from 'vitest';

import { internals, issue, runReview } from './scenario.js';

// Reject the *first* finding, so every survivor's position shifts: a routing that were off by a constant, or that read
// the scope's numbering as the union's, would still confirm the same *number* of findings.
const rejectFirst = (subject) => ({ confirmed: subject.description !== 'finding A', rationale: 'r' });

const descriptions = (run) => run.result.findings.map((finding) => finding.description);

const spread = ['a', 'b', 'c'].map((name) =>
  issue({ description: `finding ${name.toUpperCase()}`, file: `src/${name}.ts` }),
);

describe('a verdict and the finding it was about', () => {
  it('drops the finding the adjudicator rejected and keeps the ones it did not', async () => {
    const run = await runReview({ issues: spread, validate: rejectFirst });

    expect(descriptions(run)).toEqual(['finding B', 'finding C']);
  });

  it('numbers findings that share a file separately, since a verdict is about a defect and not a site', async () => {
    // Three findings, one file. Nothing here collapses them: the review reports defects, and two defects in `src/a.ts`
    // are two findings that can be judged differently.
    const run = await runReview({
      issues: ['A', 'B', 'C'].map((name) => issue({ description: `finding ${name}` })),
      validate: rejectFirst,
    });

    expect(descriptions(run)).toEqual(['finding B', 'finding C']);
  });

  it('reports nothing, and does not read as a phase that failed, when every finding is rejected', async () => {
    const run = await runReview({ issues: spread, validate: () => ({ confirmed: false, rationale: 'rejected' }) });

    expect(run.result.findings).toEqual([]);

    // An empty round is not a failed one, and the distinction is the whole difference between "nothing survived the gate"
    // and "the gate never ran" — which is what the unjudged gap in `review-gate.test.js` is about.
    expect(run.result.gaps.join(' ')).not.toContain('did not complete');
  });

  it('translates a chunked scope’s local numbering back to the scope before applying a verdict', async () => {
    // The case the routing can actually be got wrong in. An over-cap scope is cut into pair-covering chunks and each
    // chunk's agent numbers what *it* was shown from zero, so every chunk-local index is also a valid scope index — a
    // globalization that were dropped would land each verdict on a real but unrelated finding, and nothing downstream
    // could catch it.
    const { DEDUPE_CHUNK_CAP } = await internals();
    const count = DEDUPE_CHUNK_CAP + 5;
    const many = Array.from({ length: count }, (_, i) => issue({ description: `finding ${i}`, file: `src/f${i}.ts` }));

    const run = await runReview({
      issues: many,
      // Reject every third, so the surviving set has holes in it at a period no chunk boundary shares. A verdict shifted
      // by a block offset would confirm a different third of the findings, at the same count.
      validate: (subject) => {
        const idx = Number(subject.description.match(/\d+/)[0]);

        return { confirmed: idx % 3 !== 0, rationale: 'r' };
      },
    });

    // More than one chunk, or this asserts nothing about chunking at all.
    expect(run.called(/^adjudicate:core:.+:/).length).toBeGreaterThan(1);
    expect(descriptions(run)).toEqual(
      Array.from({ length: count }, (_, i) => i)
        .filter((i) => i % 3 !== 0)
        .map((i) => `finding ${i}`),
    );
  });

  it('carries a confirmation across a cross-unit merge rather than taking the surviving copy’s verdict', async () => {
    // Adjudication is per unit and the cross pass runs after it, so two reports of one defect are judged by two agents
    // that read two different sites, and may disagree. The merge then keeps one of the two copies — the lowest-indexed
    // one, which is a fact about the order the partitioner emitted its units in and nothing else. So `withMarksOf` OR-es
    // the confirmation across the group: whichever copy survives is confirmed if either was.
    //
    // The first test in this file is the control. Same findings, same `rejectFirst`, no merge — and A is gone.
    const run = await runReview({
      units: ['a', 'b', 'c'].map((name) => ({ name: `unit-${name}`, summary: name, paths: [`src/${name}.ts`] })),
      issues: spread,
      dedupe: () => ({ groups: [[0, 1]] }),
      validate: rejectFirst,
    });

    expect(descriptions(run)).toEqual(['finding A', 'finding C']);
    expect(run.result.newFindings).toBe(2);
  });
});
