/**
 * The two majority gates: validators deciding whether a finding is real, and fix reviewers deciding whether a commit
 * should land. Both approve on a *strict* majority of the agents that actually returned, so a tie is a rejection and a
 * phase where nothing returned is a gap rather than a silent pass.
 */

import { describe, expect, it } from 'vitest';

import { issue, outcomeAt, runFix } from './scenario.js';

describe('validation', () => {
  it('drops a finding that only half its validators confirm', async () => {
    // 1-of-2 is not a majority. Keeping it would put an unconfirmed finding in front of a fix agent.
    const run = await runFix({ args: { depth: 2 }, validate: (subject, { vote }) => ({
      confirmed: vote === 0,
      rationale: 'split',
    }) });

    expect(run.called(/^validate:/)).toHaveLength(2);
    expect(run.result.findings).toEqual([]);
    expect(run.result.fix).toBeUndefined();
  });

  it('keeps a finding two of three validators confirm', async () => {
    const run = await runFix({ args: { depth: 3 }, validate: (subject, { vote }) => ({
      confirmed: vote !== 2,
      rationale: 'mostly agreed',
    }) });

    expect(run.result.findings).toHaveLength(1);
  });

  it('records a gap when no validator returns, rather than dropping the finding quietly', async () => {
    const run = await runFix({ validate: () => null });

    expect(run.result.findings).toEqual([]);
    expect(run.result.gaps.join(' ')).toContain('Validation did not complete');
  });
});

describe('fix review', () => {
  it('rejects a commit that only half its reviewers approve', async () => {
    const run = await runFix({
      args: { reviewers: 2 },
      reviewFix: (subject, { vote }) => ({ approved: vote === 0, objection: vote === 0 ? '' : 'misses a case' }),
    });

    expect(outcomeAt(run, 0).status).toBe('review-rejected');
    expect(outcomeAt(run, 0).reason).toContain('misses a case');
  });

  it('revises a rejected fix up to the cap, then leaves it unfixed', async () => {
    // Three fix attempts in total — the original plus two revisions — each independently reviewed.
    const run = await runFix({ reviewFix: () => ({ approved: false, objection: 'misses a case' }) });

    expect(run.called(/^fix:/)).toHaveLength(1);
    expect(run.called(/^revise:/)).toHaveLength(2);
    expect(run.called(/^review-fix:/)).toHaveLength(3);
    expect(run.result.fix.commits).toEqual([]);
    expect(outcomeAt(run, 0).status).toBe('review-rejected');
  });

  it('lands a revision that is approved, and shows the reviser the objection', async () => {
    const run = await runFix({
      reviewFix: (subject, { attempt }) => ({
        approved: attempt > 0,
        objection: attempt > 0 ? '' : 'the null case is unhandled',
      }),
    });

    const [revision] = run.called(/^revise:/);
    expect(revision.prompt).toContain('This is a REVISION');
    expect(revision.prompt).toContain('the null case is unhandled');
    expect(outcomeAt(run, 0).status).toBe('applied');
    expect(run.result.fix.commits).toHaveLength(1);
  });

  it('does not spend revisions when the review itself could not run', async () => {
    // No reviewer returning is an infrastructure gap, not a verdict on the fix; revising against a non-existent
    // objection would burn two more Opus agents to reach the same place.
    const run = await runFix({ reviewFix: () => null });

    expect(run.called(/^revise:/)).toEqual([]);
    expect(outcomeAt(run, 0).status).toBe('review-rejected');
    expect(run.result.gaps.join(' ')).toContain('Fix review did not complete');
  });

  it('is skipped entirely with --reviewers 0', async () => {
    const run = await runFix({ args: { reviewers: 0 } });

    expect(run.called(/^review-fix:/)).toEqual([]);
    expect(outcomeAt(run, 0).status).toBe('applied');
    expect(run.result.fix.commits).toHaveLength(1);
  });
});

describe('a declined fix', () => {
  it('is never sent for review, since there is no commit to review', async () => {
    const run = await runFix({
      issues: [issue()],
      fix: () => ({ status: 'declined', branch: 'rrfix/wf_test/0', reason: 'not a safe localized edit' }),
    });

    expect(run.called(/^review-fix:/)).toEqual([]);
    expect(outcomeAt(run, 0).status).toBe('declined');
  });

  it('is reported as verify-failed when it claims to have applied without committing', async () => {
    // 'applied' is one of the two statuses the wrapper reports as fixed, and the commit list drops SHA-less fixes — so
    // passing the status through would report a fix that does not exist. `runFixer`'s own guard catches this first,
    // which is why the outcome carries its wording and not `asOutcome`'s: that second downgrade is unreachable, because
    // nothing reaches `asOutcome` with an `applied` status and an unusable SHA.
    const run = await runFix({ fix: () => ({ status: 'applied', branch: 'rrfix/wf_test/0', reason: 'done' }) });

    expect(outcomeAt(run, 0).status).toBe('verify-failed');
    expect(outcomeAt(run, 0).reason).toContain('without a usable commit SHA');
    expect(run.result.fix.commits).toEqual([]);

    // The branch still gets torn down: it was created in step 0, before the fix was attempted.
    expect(run.result.fix.sandboxBranches).toEqual(['rrfix/wf_test/0']);
  });
});
