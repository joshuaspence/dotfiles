/**
 * What survives to `fix.commits`, and what the script refuses.
 *
 * The wrapper cherry-picks these commits in order onto a fresh branch, so every one of them must share a base and touch
 * files no other one touches. Every input to that judgement is a self-reported list from an agent this script cannot
 * audit — it has no git access — so the rule throughout is to drop what cannot be proven rather than pass it along. A
 * dropped fix is reported honestly as unfixed; an overlapping one aborts the landing and strands every commit behind it.
 */

import { describe, expect, it } from 'vitest';

import { commitSha, issue, outcomeAt, runFix } from './scenario.js';

// Two findings in different files, so they group separately and each fix's commit stands on its own.
const twoFindings = [
  issue({
    file: 'src/a.ts',
    description: 'the first finding',
  }),
  issue({
    file: 'src/b.ts',
    description: 'the second finding',
    category: 'security',
  }),
];

// A fixer that returns whatever file list the test dictates, keyed by finding index.
const fixerClaiming = (byIdx) => (subject, { idx }) => ({
  status: 'applied',
  sha: commitSha(idx),
  branch: `rrfix/wf_test/${idx}`,
  changedFiles: byIdx[idx],
  reason: 'fixed',
});

describe('generated build output', () => {
  // Derived from the partitioner's own exclusion reasons rather than a hardcoded path list: it already had to identify
  // generated code to leave it out of the review.
  const distExcluded = [{ path: 'dist', reason: 'generated build output, not reviewed' }];

  it('is refused, because every fix that rebuilds the same artifact writes the same path', async () => {
    const run = await runFix({
      issues: twoFindings,
      exclusions: distExcluded,
      fix: fixerClaiming({ 0: ['src/a.ts', 'dist/server.cjs'], 1: ['src/b.ts'] }),
    });

    expect(outcomeAt(run, 0).status).toBe('conflict-skipped');
    expect(outcomeAt(run, 0).sha).toBeUndefined();
    expect(outcomeAt(run, 0).reason).toContain('dist/server.cjs');
    expect(run.result.fix.commits.map((commit) => commit.sha)).toEqual([commitSha(1)]);
    expect(run.result.gaps.join(' ')).toContain('committed generated build output despite being told not to');
  });

  it('is named to the fixers so they do not stage it in the first place', async () => {
    const run = await runFix({ exclusions: distExcluded });
    const [fixer] = run.called(/^fix:/);

    expect(fixer.prompt).toContain('NEVER stage these');
    expect(fixer.prompt).toContain('- dist');
    expect(run.logged('Fixers told to leave 1 generated path(s) unstaged')).toBe(true);
  });

  it('matches whole path segments, not string prefixes', async () => {
    // `distant/` and `dist-notreally/` are not inside `dist/`. Refusing them would report a perfectly landable fix as
    // unfixed, which is the same class of silent loss in the other direction.
    const run = await runFix({
      issues: twoFindings,
      exclusions: distExcluded,
      fix: fixerClaiming({ 0: ['distant/thing.ts'], 1: ['dist-notreally/x.ts'] }),
    });

    expect(run.result.fix.outcomes.map((outcome) => outcome.status)).toEqual(['applied', 'applied']);
    expect(run.result.fix.commits).toHaveLength(2);
  });

  it('is tolerated when the commit is the only one, since it can collide with nothing', async () => {
    const run = await runFix({
      exclusions: distExcluded,
      fix: fixerClaiming({ 0: ['src/a.ts', 'dist/server.cjs'] }),
    });

    expect(outcomeAt(run, 0).status).toBe('applied');
    expect(run.result.fix.commits).toHaveLength(1);
  });
});

describe('a fix that committed but reported no files', () => {
  it('is dropped, because its file set is unknown rather than empty', async () => {
    // Collision detection keys entirely on `changedFiles`, and an empty list unions with nothing — so such a fix looks
    // disjoint from everything and sails through grouping. If it did touch a landed file, the wrapper hits a conflict
    // it was told could not happen, having already half-landed the branch.
    const run = await runFix({
      issues: twoFindings,
      fix: fixerClaiming({ 0: [], 1: ['src/b.ts'] }),
    });

    expect(outcomeAt(run, 0).status).toBe('conflict-skipped');
    expect(outcomeAt(run, 0).sha).toBeUndefined();
    expect(outcomeAt(run, 0).reason).toContain('reported no changed files');
    expect(run.result.fix.commits.map((commit) => commit.sha)).toEqual([commitSha(1)]);
  });

  it('is kept when it is the only commit', async () => {
    const run = await runFix({ fix: fixerClaiming({ 0: [] }) });

    expect(outcomeAt(run, 0).status).toBe('applied');
    expect(run.result.fix.commits).toHaveLength(1);
  });
});

describe('untrusted commit and branch names', () => {
  it('discards an applied fix whose SHA is not a bare object name', async () => {
    // These strings are interpolated into the `git show` line of the next agent's prompt and handed to a wrapper that
    // cherry-picks under a pre-authorized `Bash(git cherry-pick:*)`.
    const run = await runFix({
      fix: () => ({
        status: 'applied',
        sha: 'HEAD; rm -rf /',
        branch: 'rrfix/wf_test/0',
        changedFiles: ['src/a.ts'],
        reason: 'fixed',
      }),
    });

    expect(outcomeAt(run, 0).status).toBe('verify-failed');
    expect(outcomeAt(run, 0).sha).toBe('');
    expect(outcomeAt(run, 0).reason).toContain('without a usable commit SHA');
    expect(run.result.fix.commits).toEqual([]);
  });

  it('discards an applied fix whose branch name could traverse', async () => {
    const run = await runFix({
      fix: () => ({
        status: 'applied',
        sha: commitSha(0),
        branch: 'rrfix/../../evil',
        changedFiles: ['src/a.ts'],
        reason: 'fixed',
      }),
    });

    expect(outcomeAt(run, 0).status).toBe('verify-failed');
    expect(run.result.fix.sandboxBranches).toEqual([]);
  });
});

describe('sandboxBranches', () => {
  it('lists a declined fixer’s branch, which exists and still has to be deleted', async () => {
    // The branch is created in step 0, before the fix is attempted. Teardown works off this list rather than the
    // per-finding outcomes precisely because a declined fixer's outcome names no commit.
    const run = await runFix({
      issues: twoFindings,
      fix: (subject, { idx }) =>
        idx === 0
          ? { status: 'declined', branch: 'rrfix/wf_test/0', reason: 'not a safe localized edit' }
          : fixerClaiming({ 1: ['src/b.ts'] })(subject, { idx }),
    });

    expect(outcomeAt(run, 0).status).toBe('declined');
    expect(run.result.fix.sandboxBranches).toEqual(['rrfix/wf_test/0', 'rrfix/wf_test/1']);
  });

  it('lists every revision branch, not just the last', async () => {
    // A finding rejected through the revision cap created three branches; its outcome names only the third.
    const run = await runFix({ reviewFix: () => ({ approved: false, objection: 'misses a case' }) });

    expect(run.result.fix.sandboxBranches).toEqual([
      'rrfix/wf_test/0',
      'rrfix/wf_test/0-r1',
      'rrfix/wf_test/0-r2',
    ]);
    expect(outcomeAt(run, 0).status).toBe('review-rejected');
    // The rejected commit still exists; naming its branch is what lets the user go and look before teardown.
    expect(outcomeAt(run, 0).branch).toBe('rrfix/wf_test/0-r2');
  });

  it('does not repeat a branch two agents reported', async () => {
    const run = await runFix({
      issues: twoFindings,
      fix: () => ({
        status: 'declined',
        branch: 'rrfix/wf_test/shared',
        reason: 'declined',
      }),
    });

    expect(run.result.fix.sandboxBranches).toEqual(['rrfix/wf_test/shared']);
  });
});

describe('the report the wrapper formats', () => {
  it('never claims a finding is fixed by a commit it is not landing', async () => {
    // The invariant behind all of the above: 'applied' and 'conflict-resolved' are the two statuses the wrapper reports
    // as fixed, so either must point at a SHA in `commits`. Every gate here drops in the safe direction, and this
    // asserts the direction rather than any one gate.
    const run = await runFix({
      issues: [
        issue({ file: 'src/a.ts', description: 'lands cleanly' }),
        issue({ file: 'src/b.ts', description: 'stages an artifact', category: 'security' }),
        issue({ file: 'src/c.ts', description: 'reports no files', category: 'code-quality' }),
        issue({ file: 'src/d.ts', description: 'is declined', category: 'consistency' }),
      ],
      exclusions: [{ path: 'dist', reason: 'generated build output' }],
      fix: (subject, { idx }) =>
        idx === 3
          ? { status: 'declined', branch: 'rrfix/wf_test/3', reason: 'judgment call' }
          : fixerClaiming({ 0: ['src/a.ts'], 1: ['src/b.ts', 'dist/server.cjs'], 2: [] })(subject, { idx }),
    });

    const landed = new Set(run.result.fix.commits.map((commit) => commit.sha));
    const claimedFixed = run.result.fix.outcomes.filter((outcome) =>
      ['applied', 'conflict-resolved'].includes(outcome.status),
    );

    expect(claimedFixed.map((outcome) => outcome.description)).toEqual(['lands cleanly']);
    claimedFixed.forEach((outcome) => expect(landed).toContain(outcome.sha));
  });

  it('gives every unlanded commit a reason naming why', async () => {
    const run = await runFix({
      issues: twoFindings,
      exclusions: [{ path: 'dist', reason: 'generated build output' }],
      fix: fixerClaiming({ 0: ['src/a.ts', 'dist/server.cjs'], 1: ['src/b.ts'] }),
    });

    run.result.fix.outcomes
      .filter((outcome) => outcome.status === 'conflict-skipped')
      .forEach((outcome) => expect(outcome.reason).toBeTruthy());
  });

  it('lands commits that are pairwise disjoint', async () => {
    // The property the wrapper's cherry-pick sequence depends on, asserted over the whole returned list.
    const run = await runFix({
      issues: [
        issue({ file: 'src/a.ts', description: 'one' }),
        issue({ file: 'src/b.ts', description: 'two', category: 'security' }),
        issue({ file: 'src/b.ts', description: 'three, colliding with two', category: 'code-quality' }),
      ],
    });

    const seen = new Set();
    run.result.fix.commits.forEach((commit) => {
      commit.changedFiles.forEach((file) => {
        expect(seen.has(file), `${file} was written by more than one landed commit`).toBe(false);
        seen.add(file);
      });
    });

    expect(run.result.fix.commits.length).toBeGreaterThan(0);
  });
});

describe('a fix pipeline that dies', () => {
  it('is reported as an infrastructure failure, with the cause, not as an unfixable finding', async () => {
    const run = await runFix({
      fix: () => {
        throw new Error('worktree could not be created: no space left on device');
      },
    });

    expect(outcomeAt(run, 0).status).toBe('verify-failed');
    expect(run.result.gaps.join(' ')).toContain('The Fix phase did not run');
    expect(run.result.gaps.join(' ')).toContain('no space left on device');
  });

  it('is distinguished from a fixer that returned nothing', async () => {
    const run = await runFix({ fix: () => null });

    expect(outcomeAt(run, 0).status).toBe('verify-failed');
    expect(run.result.gaps.join(' ')).toContain('Fix agent did not return');
  });
});
