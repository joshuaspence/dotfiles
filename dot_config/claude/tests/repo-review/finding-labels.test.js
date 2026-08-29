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
});
