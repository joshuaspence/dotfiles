/**
 * The per-finding label handle (`findingTag`), and what it has to be numbered over.
 *
 * Validation is the only per-finding phase left in this command, so the handle now has one reader in the progress tree
 * rather than four — but the number is still the thing a reader matches a `validate:bug#7` row against, and the list it
 * counts over is `deduped`, which dedupe has already reordered and merged. Numbering it over anything narrower would
 * re-point every label after the first merge, and a run watched live would show a validator judging a finding the reader
 * cannot find.
 *
 * The other half of the invariant left with the fixing: `/repo-review-fix` numbers its own sandbox branches
 * (`rrfix/<RUN>/<n>`) over the findings it selected out of the ledger, which is what makes a branch traceable to a
 * finding. That is pinned in `tests/repo-review-fix/base-pinning.test.js` and `tests/repo-review-fix/branches.test.js`.
 */

import { describe, expect, it } from 'vitest';

import { internals, issue, runReview } from './scenario.js';

// Reject the *first* finding, so every survivor's position shifts and a list numbered after validation cannot coincide
// with the labels by luck.
const rejectFirst = (subject) => ({ confirmed: subject.description !== 'finding A', rationale: 'r' });

const descriptions = (run) => run.result.findings.map((finding) => finding.description);

describe('per-finding label handle', () => {
  it('numbers every finding the validators were given, including the ones they go on to reject', async () => {
    const run = await runReview({
      issues: [
        issue({ description: 'finding A', file: 'src/a.ts' }),
        issue({ description: 'finding B', file: 'src/b.ts' }),
        issue({ description: 'finding C', file: 'src/c.ts' }),
      ],
      validate: rejectFirst,
    });

    expect(run.called(/^validate:/).map((call) => call.label)).toEqual([
      'validate:bug#0',
      'validate:bug#1',
      'validate:bug#2',
    ]);

    // `bug#0` was rejected, so the handle it held is simply not reused: the reported list is shorter, and the two
    // findings in it are the ones `validate:bug#1` and `validate:bug#2` confirmed.
    expect(descriptions(run)).toEqual(['finding B', 'finding C']);
  });

  it('numbers findings that share a file separately, since the handle names a finding and not a site', async () => {
    // Three findings, one file. Nothing here collapses them: the review reports defects, and two defects in `src/a.ts`
    // are two rows a reader has to be able to tell apart in the progress tree.
    const run = await runReview({
      issues: [
        issue({ description: 'finding A' }),
        issue({ description: 'finding B' }),
        issue({ description: 'finding C' }),
      ],
      validate: rejectFirst,
    });

    expect(run.called(/^validate:/).map((call) => call.label)).toEqual([
      'validate:bug#0',
      'validate:bug#1',
      'validate:bug#2',
    ]);
    expect(descriptions(run)).toEqual(['finding B', 'finding C']);
  });

  it('reports nothing, and spawns nothing further, when the validators reject every finding', async () => {
    const run = await runReview({
      issues: [
        issue({ description: 'finding A', file: 'src/a.ts' }),
        issue({ description: 'finding B', file: 'src/b.ts' }),
        issue({ description: 'finding C', file: 'src/c.ts' }),
      ],
      validate: () => ({ confirmed: false, rationale: 'rejected' }),
    });

    expect(run.called(/^validate:/)).toHaveLength(3);
    expect(run.result.findings).toEqual([]);

    // An empty round is not a failed one: nothing here should read as a phase that did not complete.
    expect(run.result.gaps.join(' ')).not.toContain('did not complete');
  });

  it('preserves label numbering across chunked dedupe scopes', async () => {
    // An over-cap scope is split into pair-covering chunks, each judged by its own agent. The numbering is assigned once
    // the chunks are back and the scope is whole again, so a finding's handle does not depend on which chunk it landed in.
    const { DEDUPE_CHUNK_CAP } = await internals();

    // Just over half the cap, so two blocks become multiple chunks.
    const count = Math.floor(DEDUPE_CHUNK_CAP / 2) + 5;
    const manyIssues = Array.from({ length: count }, (_, i) =>
      issue({ description: `finding ${i}`, file: `src/file${i}.ts` }),
    );

    const run = await runReview({
      issues: manyIssues,
      // Reject every third finding, so the surviving numbers have gaps in them and a re-numbered list would show.
      validate: (subject) => {
        const idx = Number(subject.description.match(/\d+/)[0]);

        return { confirmed: idx % 3 !== 0, rationale: idx % 3 !== 0 ? 'ok' : 'rejected' };
      },
    });

    const validateLabels = run.called(/^validate:/).map((call) => call.label);

    expect(validateLabels).toHaveLength(count);
    expect(validateLabels).toEqual(Array.from({ length: count }, (_, i) => `validate:bug#${i}`));

    // The reported findings are exactly the ones whose handles the validators confirmed, in the same order.
    const expected = Array.from({ length: count }, (_, i) => i).filter((i) => i % 3 !== 0);

    expect(descriptions(run)).toEqual(expected.map((i) => `finding ${i}`));
  });

  it('maintains stable labels through multi-pass cross-dedupe', async () => {
    // Cross-unit dedupe can run several passes to close a duplicate chain, each pass re-indexing its own input. The
    // handles are numbered after the last of them, so a chain that collapsed three findings into one still leaves the
    // survivors contiguously numbered from zero.
    const run = await runReview({
      // Findings in different units, which is what makes cross-dedupe run at all.
      units: [
        { name: 'unit-a', summary: 'unit A', paths: ['src/a.ts'] },
        { name: 'unit-b', summary: 'unit B', paths: ['src/b.ts'] },
        { name: 'unit-c', summary: 'unit C', paths: ['src/c.ts'] },
      ],
      issues: [
        issue({ description: 'finding A', file: 'src/a.ts' }),
        issue({ description: 'finding B', file: 'src/b.ts' }),
        issue({ description: 'finding C', file: 'src/c.ts' }),
      ],
      // A duplicate chain: the first pass merges A+B, the second merges (A+B)+C.
      dedupe: (call) => {
        if (call.label.includes('dedupe:cross')) {
          const hasA = call.prompt.includes('finding A');
          const hasB = call.prompt.includes('finding B');
          const hasC = call.prompt.includes('finding C');

          if (hasA && hasB && hasC) return { groups: [{ members: [0, 1], survivor: 0 }] };

          // The second pass operates on the survivors — (A+B) and C — now at indices 0 and 1.
          if ((hasA || hasB) && hasC) return { groups: [{ members: [0, 1], survivor: 0 }] };
        }

        return { groups: [] };
      },
      validate: rejectFirst,
    });

    const validateLabels = run.called(/^validate:/).map((call) => call.label);

    expect(validateLabels.every((label) => /^validate:bug#\d+$/.test(label))).toBe(true);
    expect(validateLabels).toEqual(validateLabels.map((_, i) => `validate:bug#${i}`));
  });
});
