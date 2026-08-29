/**
 * The per-finding label handle (`findingTag`) is one number a reader follows across four phases: the validator that
 * judged a finding, the fixer that edited it, the reviser, and the fix reviewer — plus the sandbox branch the fixer is
 * told to create (`rrfix/<RUN>/<n>`). That only holds if the number names the *finding* rather than a position in
 * whichever array the current phase happens to be iterating: validation drops findings, so the fix phase runs over a
 * shorter list, and numbering that list afresh silently re-points every label after the first drop.
 */

import { describe, expect, it } from 'vitest';

import { issue, runFix } from './scenario.js';

// Reject the *first* finding, so every survivor's position shifts and a freshly numbered fix phase cannot coincide with
// the validate phase by luck.
const rejectFirst = (subject) => ({ confirmed: subject.description !== 'finding A', rationale: 'r' });

describe('per-finding label handle', () => {
  // Distinct files, so each fix is its own reconciliation group and nothing is merged.
  const dropFirst = {
    issues: [
      issue({ description: 'finding A', file: 'src/a.ts' }),
      issue({ description: 'finding B', file: 'src/b.ts' }),
      issue({ description: 'finding C', file: 'src/c.ts' }),
    ],
    validate: rejectFirst,
  };

  it('keeps naming the same finding after validation drops an earlier one', async () => {
    const run = await runFix(dropFirst);

    expect(run.called(/^validate:/).map((call) => call.label)).toEqual([
      'validate:bug#0',
      'validate:bug#1',
      'validate:bug#2',
    ]);

    // `bug#0` was rejected, so it must not reappear: `fix:bug#1` has to be the finding `validate:bug#1` confirmed.
    expect(run.called(/^fix:/).map((call) => call.label)).toEqual(['fix:bug#1', 'fix:bug#2']);
    expect(run.called(/^review-fix:/).map((call) => call.label)).toEqual(['review-fix:bug#1', 'review-fix:bug#2']);
  });

  it('gives the fixer the branch number its own label carries', async () => {
    // The branch is how a user goes and looks at the commit for a finding, so `rrfix/<RUN>/1` must belong to the
    // finding labelled `#1` and not to whichever survivor happened to be second.
    const run = await runFix(dropFirst);
    const [first, second] = run.called(/^fix:/);

    expect(first.prompt).toContain('rrfix/<RUN>/1');
    expect(second.prompt).toContain('rrfix/<RUN>/2');
    expect(run.result.fix.outcomes.map((outcome) => outcome.description)).toEqual(['finding B', 'finding C']);
  });

  it('names the merged findings in a reconcile label by the same handle', async () => {
    // Two survivors fixing the same file collide, so they reconcile as one group — labelled by the findings it merges.
    const run = await runFix({
      issues: [
        issue({ description: 'finding A' }),
        issue({ description: 'finding B' }),
        issue({ description: 'finding C' }),
      ],
      validate: rejectFirst,
    });

    expect(run.called(/^reconcile:/).map((call) => call.label)).toEqual(['reconcile:bug#1+bug#2']);
  });

  it('produces no fix agents when all findings are rejected', async () => {
    // If validators reject everything, the fix phase should be empty — no labels emitted at all.
    const rejectAll = () => ({ confirmed: false, rationale: 'rejected' });
    const run = await runFix({
      issues: [
        issue({ description: 'finding A', file: 'src/a.ts' }),
        issue({ description: 'finding B', file: 'src/b.ts' }),
        issue({ description: 'finding C', file: 'src/c.ts' }),
      ],
      validate: rejectAll,
    });

    expect(run.called(/^validate:/).map((call) => call.label)).toEqual([
      'validate:bug#0',
      'validate:bug#1',
      'validate:bug#2',
    ]);

    // No survivors, so no fix agents spawned.
    expect(run.called(/^fix:/).map((call) => call.label)).toEqual([]);
    expect(run.called(/^review-fix:/).map((call) => call.label)).toEqual([]);
  });

  it('preserves label numbering across chunked dedupe scopes', async () => {
    // When a dedupe scope is large enough to be chunked, findings still keep their original numbering. The script
    // splits over-cap scopes into pair-covering chunks, but the label on each finding remains stable.
    const { DEDUPE_CHUNK_CAP } = await import('./scenario.js').then((m) => m.internals());

    // Create enough findings to trigger chunking (just over half the cap, so two blocks become multiple chunks).
    const count = Math.floor(DEDUPE_CHUNK_CAP / 2) + 5;
    const manyIssues = Array.from({ length: count }, (_, i) =>
      issue({ description: `finding ${i}`, file: `src/file${i}.ts` }),
    );

    const run = await runFix({
      issues: manyIssues,
      validate: (subject) => {
        // Reject every third finding to create gaps, forcing label numbers to skip.
        const idx = Number(subject.description.match(/\d+/)[0]);
        return { confirmed: idx % 3 !== 0, rationale: idx % 3 !== 0 ? 'ok' : 'rejected' };
      },
    });

    const validateLabels = run.called(/^validate:/).map((call) => call.label);
    const fixLabels = run.called(/^fix:/).map((call) => call.label);

    // Validators ran for all findings in original order.
    expect(validateLabels).toHaveLength(count);
    expect(validateLabels.every((label, i) => label === `validate:bug#${i}`)).toBe(true);

    // Fix labels skip the rejected findings but preserve their original indices.
    const expectedFixIndices = Array.from({ length: count }, (_, i) => i).filter((i) => i % 3 !== 0);
    expect(fixLabels).toEqual(expectedFixIndices.map((i) => `fix:bug#${i}`));
  });

  it('maintains stable labels through multi-pass cross-dedupe', async () => {
    // Cross-unit dedupe can run multiple passes to close duplicate chains. Labels must remain stable across passes.
    const run = await runFix({
      // Put findings in different units so cross-dedupe runs.
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
      // Simulate a duplicate chain: first pass merges A+B, second pass merges (A+B)+C.
      dedupe: (call) => {
        // Look for cross-dedupe passes.
        if (call.label.includes('dedupe:cross')) {
          const hasA = call.prompt.includes('finding A');
          const hasB = call.prompt.includes('finding B');
          const hasC = call.prompt.includes('finding C');

          // First pass: report A and B as duplicates.
          if (hasA && hasB && hasC) {
            return { groups: [{ members: [0, 1], survivor: 0 }] };
          }

          // Second pass operates on survivors: (A+B) and C, now at indices 0 and 1.
          if ((hasA || hasB) && hasC) {
            return { groups: [{ members: [0, 1], survivor: 0 }] };
          }
        }

        return { groups: [] };
      },
      validate: rejectFirst,
    });

    // After validation drops finding A (bug#0), survivors are B and C as bug#1 and bug#2.
    const fixLabels = run.called(/^fix:/).map((call) => call.label);

    // Despite multi-pass dedupe potentially merging findings, the labels that make it through still refer to the
    // original finding indices from the validation phase.
    expect(fixLabels.every((label) => label.startsWith('fix:bug#'))).toBe(true);
    expect(fixLabels.every((label) => !label.includes('bug#0'))).toBe(true);
  });
});
