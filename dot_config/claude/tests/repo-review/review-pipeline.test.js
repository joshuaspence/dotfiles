/**
 * Review and the first dedupe stage as one `pipeline()` over the units.
 *
 * The two phases used to be a `parallel()` pair, which made every unit's dedupe wait on the slowest reviewer in the
 * *whole round* — and a run killed anywhere in that window produced nothing at all. They are now one pipeline item per
 * unit, so a unit deduplicates the moment its own reviewers are in.
 *
 * Three of the four tests here are about arrangement rather than results: which agents ran, in what order, and what
 * happened when an item died. That is deliberate. The measured lesson from the earlier phases is that cost-shaped
 * behaviour is invisible to result assertions — two of Phase E1's eight mutations changed no returned value at all and
 * were caught only by agent-call counts — and the ordering this phase depends on is the same kind of property: run the
 * pipeline as a barrier again and every finding still comes back, just hours later.
 *
 * The exception is `cross-scope ordering`, which is a correctness test wearing a cost test's clothes: concatenating
 * per-unit scopes can put one unit's new finding above another unit's held one, and `mergeIssueGroups` keeps the marks
 * of the *lowest-indexed* member of a group. Get that wrong and the ledger's entry for a known defect is replaced by
 * this round's re-report of it, which is then validated and fixed again as though it had never been seen.
 */

import { describe, expect, it } from 'vitest';

import { pipelineImpl } from '../harness.js';
import { issue, runReview } from './scenario.js';

// Two findings per unit, which is the smallest scope a dedupe agent runs for at all — one finding has nothing to be
// compared against, so a unit holding one spends no agent and would make the ordering below unobservable.
const spread = [
  issue({ description: 'frame length unchecked', file: 'api/handler.py' }),
  issue({ description: 'retry loop is unbounded', file: 'api/routes.py' }),
  issue({ description: 'partial read treated as EOF', file: 'core/wire.py' }),
  issue({ description: 'frame buffer is reused', file: 'core/frame.py' }),
];

// `slug` is what reaches a label, and the orchestration derives it from `name` (see `unit-labels.test.js`); these two
// are already slug-shaped, so it is spelled out rather than computed.
const units = [
  { name: 'api', slug: 'api', summary: 'the request surface', paths: ['api'] },
  { name: 'core', slug: 'core', summary: 'the protocol', paths: ['core'] },
];

// A `pipeline` that drops one unit the way the runtime does when an agent inside a stage stalls: the no-progress watchdog
// makes that a throw, not a `null`, and a throw out of a stage takes the whole item down. Wraps the harness's real
// implementation so everything else about the run is unchanged.
const dropUnit = (slug) => (items, ...stages) =>
  pipelineImpl(
    items,
    ...stages.map((stage) => (value, item, index) => {
      if (item?.slug === slug) {
        throw new Error(`Simulating a stalled agent in unit '${slug}'.`);
      }

      return stage(value, item, index);
    }),
  );

describe('per-unit review pipeline', () => {
  it("deduplicates a unit as soon as its own reviewers are in, not when the round's are", async () => {
    // Deterministic rather than timed: `core`'s reviewers answer in microtasks while `api`'s answer from a timer, so
    // every microtask the pipeline can make progress on — `core`'s reviewers *and* its stage-2 dedupe — necessarily
    // drains before the first `api` answer exists. Under a barrier `dedupe:core` is unreachable until `api` has returned,
    // so this is the one assertion that tells the two structures apart.
    const order = [];

    const run = await runReview({
      issues: spread,
      units,
      review: async (call, { unit, categories }) => {
        // The architecture lenses read the whole repository rather than a unit, so they own none of these findings.
        if (unit === 'arch') return { issues: [] };

        if (unit === 'api') await new Promise((resolve) => setTimeout(resolve, 0));

        order.push(call.label);

        return { issues: spread.filter((f) => categories.includes(f.category) && f.file.startsWith(`${unit}/`)) };
      },
      dedupe: (call) => {
        order.push(call.label);

        return { groups: [] };
      },
    });

    const coreDedupe = order.indexOf('dedupe:core:high');
    const firstApiReview = order.findIndex((label) => label.startsWith('review:api:'));

    expect(coreDedupe).toBeGreaterThan(-1);
    expect(firstApiReview).toBeGreaterThan(-1);
    expect(coreDedupe).toBeLessThan(firstApiReview);

    // And the round still ends up with everything, which is what makes the ordering a saving rather than a shortcut.
    expect(run.result.findings).toHaveLength(spread.length);
  });

  it('runs no dedupe agent for a unit that found nothing new this round', async () => {
    // A unit whose scope is all held findings has nothing to merge: they were deduped by the round that produced them,
    // and re-comparing a settled set is a full Opus agent spent to be told `groups: []`. Under the shared union this ran
    // once per unit on every round after the first, which is a per-round cost proportional to the partition rather than
    // to what the round found.
    const held = spread.slice(2);
    const run = await runReview({
      issues: spread.slice(0, 2),
      units,
      args: { round: 2, knownFindings: held },
    });

    expect(run.called(/^dedupe:core/)).toEqual([]);

    // `api` found a pair, so it deduplicates; the cross pass still runs, because the two units' findings have only ever
    // been compared within their own scopes and that is the duplicate this phase cannot see.
    expect(run.called(/^dedupe/).map((call) => call.label)).toEqual(['dedupe:api:high', 'dedupe:cross:high']);
  });

  it('hands a finding cited outside the reviewing unit to the leftovers scope rather than dropping it', async () => {
    // A reviewer is given one unit's files but nothing stops it citing another's, and that finding cannot be deduped
    // where it was reported: the unit that owns the file may already have finished. It is therefore neither kept in the
    // reporting unit's scope — which would let two units both dedupe it, and put it past its owner's cap — nor discarded,
    // which is the failure worth testing for, since a silently dropped finding looks exactly like a clean review.
    const apiFinding = issue({ description: 'handler ignores the parse error', file: 'api/handler.py' });
    const strays = [
      issue({ description: 'wire read is unchecked', file: 'core/wire.py' }),
      issue({ description: 'frame buffer is reused', file: 'core/frame.py' }),
    ];
    const coreFinding = issue({ description: 'handshake timeout ignored', file: 'core/buffer.py' });

    const run = await runReview({
      issues: [apiFinding, ...strays, coreFinding],
      units,
      review: (_call, { unit, categories }) => {
        if (!categories.includes('bug')) return { issues: [] };
        if (unit === 'api') return { issues: [apiFinding, ...strays] };
        if (unit === 'core') return { issues: [coreFinding] };

        return { issues: [] };
      },
    });

    // Not the reporting unit's to merge: `api`'s own scope is one finding, so it spends no agent, and the two strays are
    // compared in the leftovers scope instead — which is also where they meet any copy the ledger already holds.
    const deduped = run.called(/^dedupe/);

    expect(deduped.map((call) => call.label)).toEqual(['dedupe:cross-cutting:high', 'dedupe:cross:high']);
    expect(deduped[0].prompt).toContain(strays[0].description);
    expect(deduped[0].prompt).toContain(strays[1].description);
    expect(deduped[0].prompt).not.toContain(apiFinding.description);

    // And all four survive the round: nothing was lost on the way between the scopes.
    expect(run.result.findings).toHaveLength(4);
  });

  it("carries a unit's held findings through when its pipeline item dies outright", async () => {
    // The one failure mode no fake `agent` can produce: a stage that throws drops that item to `null`, and that item is
    // where the findings already held for the unit were waiting to be merged back in. Skipping the null would erase
    // every earlier round's findings for the unit from the ledger — the same loss the phase's three abort returns exist
    // to prevent — so the null is refilled from `held` and the round reports itself as partial.
    const held = spread.slice(2);
    const run = await runReview({
      issues: spread.slice(0, 2),
      units,
      args: { round: 2, knownFindings: held },
      pipeline: dropUnit('core'),
    });

    expect(run.called(/^review:core/)).toEqual([]);
    expect(run.result.gaps).toContainEqual(expect.stringMatching(/unit 'core' in round 2 failed outright/));
    expect(run.result.gaps).toContainEqual(expect.stringContaining('2 finding(s) already held'));

    // Both held findings are still in the ledger, alongside the two the surviving unit found.
    expect(run.result.findings.map((finding) => finding.description)).toEqual(
      expect.arrayContaining(held.map((finding) => finding.description)),
    );
    expect(run.result.findings).toHaveLength(spread.length);
  });
});

describe('cross-scope ordering', () => {
  it('keeps the held copy of a defect two units both reported, not this round’s', async () => {
    // Each scope puts its own held findings above its own new ones, but concatenating the scopes interleaves them again:
    // `api`'s new finding lands above `core`'s held one. `mergeIssueGroups` carries a group's marks over from its
    // lowest-indexed member, so without a re-partition immediately before the cross pass the new report wins the merge —
    // the ledger entry is replaced, `firstSeen` and everything the round that first saw it recorded are lost, and the
    // defect is judged and fixed again from scratch.
    const known = issue({ description: 'partial read treated as EOF', file: 'core/wire.py' });
    const found = issue({ description: 'read returns short and is not retried', file: 'api/handler.py' });

    const run = await runReview({
      issues: [found],
      units,
      // Named explicitly because the ceiling is a function of it, and one finding cites one file — which sizes the
      // review for a single unit and coalesces the partition this test is about the seam between.
      survey: { inScopeFileCount: 4 },
      args: { round: 2, knownFindings: [known] },
      // Each unit's scope holds one finding, so stage 1 runs no agent at all and this answers the cross pass.
      dedupe: () => ({ groups: [[0, 1]] }),
    });

    expect(run.result.findings.map((finding) => finding.description)).toEqual([known.description]);

    // The two halves of what the marks are for: nothing new to report to the caller, and nothing to re-judge.
    expect(run.result.newFindings).toBe(0);
    expect(run.called(/^validate/)).toEqual([]);
  });
});
