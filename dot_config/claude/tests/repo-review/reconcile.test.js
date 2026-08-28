/**
 * Grouping colliding fixes, and merging them into one landable commit.
 *
 * Two fixes that touch a shared file cannot both be cherry-picked, so they go to one reconciliation agent instead. The
 * groups are proven disjoint from each other using the fixers' own file lists — which is why a merged commit that
 * writes anything outside its group's union is disjoint from nothing, and voids the guarantee for every commit in the
 * sequence.
 */

import { describe, expect, it } from 'vitest';

import { commitSha, internals, issue, outcomeAt, runFix } from './scenario.js';

describe('groupByFileCollision', () => {
  const group = async (...changedFiles) =>
    (await internals()).groupByFileCollision(changedFiles.map((files) => ({ changedFiles: files })));

  it('leaves fixes that share no file in separate groups', async () => {
    expect(await group(['a'], ['b'])).toEqual([[0], [1]]);
  });

  it('groups transitively, so a chain of overlaps merges into one', async () => {
    // A and C share nothing directly, but both must land with B, and all three have to be one commit.
    expect(await group(['x'], ['x', 'y'], ['y'])).toEqual([[0, 1, 2]]);
  });

  it('puts a fix reporting no files in its own group, which is why the caller drops those first', async () => {
    // An empty list unions with nothing, so such a fix looks disjoint from everything. Grouping cannot detect that; the
    // caller refuses the commit before it gets here.
    expect(await group([], [])).toEqual([[0], [1]]);
  });

  it('handles an absent file list without throwing', async () => {
    const { groupByFileCollision } = await internals();

    expect(groupByFileCollision([{}, { changedFiles: ['a'] }])).toEqual([[0], [1]]);
    expect(groupByFileCollision([])).toEqual([]);
  });
});

describe('fileInUnit', () => {
  // Tested beside `groupByFileCollision` because it is the script's other path matcher, and it carries the same
  // segment-boundary rule as `isGeneratedPath`: a unit path is a whole file or a whole directory, never a prefix of a
  // sibling's name. It scopes already-reported findings to a unit when feeding later `--loop` rounds.
  const fileInUnit = async (file, paths) => (await internals()).fileInUnit(file, { paths });

  it('matches a file listed exactly, or one inside a listed directory', async () => {
    expect(await fileInUnit('src/a.ts', ['src/a.ts'])).toBe(true);
    expect(await fileInUnit('src/deep/a.ts', ['src'])).toBe(true);
    expect(await fileInUnit('src/a.ts', ['src/'])).toBe(true);
  });

  it('does not match a sibling whose name merely starts the same way', async () => {
    expect(await fileInUnit('srcx/a.ts', ['src'])).toBe(false);
    expect(await fileInUnit('src/ab.ts', ['src/a.ts'])).toBe(false);
  });

  it('is false for a finding with no file, and for a unit with no paths', async () => {
    // Repo-wide findings can arrive without a primary file; they must not silently match every unit.
    expect(await fileInUnit('', ['src'])).toBe(false);
    expect(await fileInUnit(undefined, ['src'])).toBe(false);
    expect(await fileInUnit('src/a.ts', undefined)).toBe(false);
  });
});

// Two findings in the same file: they collide, so they are reconciled rather than landed separately.
const colliding = [
  issue({ file: 'src/a.ts', description: 'the first finding' }),
  issue({ file: 'src/a.ts', description: 'the second finding in the same file' }),
];

describe('a successful reconciliation', () => {
  it('lands one commit and points both findings at it', async () => {
    const run = await runFix({ issues: colliding });

    expect(run.called(/^reconcile:/)).toHaveLength(1);
    expect(run.result.fix.commits).toHaveLength(1);
    expect(run.result.fix.commits[0]).toMatchObject({ sha: commitSha(900), findingCount: 2 });

    // The individual fixer commits are superseded and never cherry-picked, so both outcomes must name the merged one.
    run.result.fix.outcomes.forEach((outcome) => {
      expect(outcome.status).toBe('conflict-resolved');
      expect(outcome.sha).toBe(commitSha(900));
    });
  });

  it('names the findings it is merging, and the files it may touch', async () => {
    const run = await runFix({ issues: colliding });
    const [reconciler] = run.called(/^reconcile:/);

    expect(reconciler.label).toBe('reconcile:bug#0+bug#1');
    expect(reconciler.prompt).toContain('In-bounds files (1):\n- src/a.ts');
    expect(reconciler.prompt).toContain('STAY IN BOUNDS');
  });
});

describe('a merged commit that strays outside its group', () => {
  const strayed = () =>
    runFix({
      issues: colliding,
      reconcile: ({ fixes }) => ({
        status: 'resolved',
        sha: commitSha(900),
        branch: 'rrmerge/wf_test/0',
        // A rebuilt bundle is the observed case: the merge verified, and its verification step rewrote `dist/`.
        changedFiles: [...fixes.flatMap((result) => result.changedFiles), 'dist/server.cjs'],
        reason: 'combined both fixes',
      }),
    });

  it('is treated as a failed reconciliation', async () => {
    // In the observed run a 30-finding merge touched 25 files and overlapped three commits later in the sequence. The
    // alternative to refusing it is handing the wrapper a commit it aborts on after already landing others.
    const run = await strayed();

    expect(run.result.fix.commits).toEqual([]);
    expect(run.result.gaps.join(' ')).toContain('Reconciliation failed for 2 colliding fix(es)');
  });

  it('leaves its findings unfixed, naming the file that voided the guarantee', async () => {
    const run = await strayed();

    run.result.fix.outcomes.forEach((outcome) => {
      expect(outcome.status).toBe('conflict-skipped');
      expect(outcome.sha).toBeUndefined();
      expect(outcome.reason).toContain('dist/server.cjs');
      expect(outcome.reason).toContain('outside the files its fixes touched');
    });
  });

  it('still records its branch for teardown', async () => {
    const run = await strayed();

    expect(run.result.fix.sandboxBranches).toContain('rrmerge/wf_test/0');
  });
});

describe('a reconciliation that cannot produce a commit', () => {
  it.each([
    [
      'reports failure',
      () => ({ status: 'failed', branch: 'rrmerge/wf_test/0', reason: 'the two fixes genuinely contradict' }),
    ],
    [
      'returns an unusable SHA',
      () => ({ status: 'resolved', sha: 'HEAD~1', branch: 'rrmerge/wf_test/0', changedFiles: ['src/a.ts'], reason: '' }),
    ],
    ['never returns', () => null],
  ])('marks the whole group unfixed when it %s', async (_label, reconcile) => {
    const run = await runFix({ issues: colliding, reconcile });

    expect(run.result.fix.commits).toEqual([]);
    expect(outcomeAt(run, 0).status).toBe('conflict-skipped');
    expect(outcomeAt(run, 1).status).toBe('conflict-skipped');
    expect(outcomeAt(run, 0).sha).toBeUndefined();
  });

  it('reports the underlying error when the agent dies', async () => {
    // `parallel` would flatten a throw to a bare `null`, dropping the group from `commits` while its fixes kept a SHA
    // nothing ever cherry-picks — reported as landed and silently lost.
    const run = await runFix({
      issues: colliding,
      reconcile: () => {
        throw new Error('worktree could not be created');
      },
    });

    expect(run.result.fix.commits).toEqual([]);
    expect(outcomeAt(run, 0).status).toBe('conflict-skipped');
    expect(run.result.gaps.join(' ')).toContain('Cause: worktree could not be created');
  });
});

describe('fixes that do not collide', () => {
  it('skip reconciliation entirely and land the fixers’ own commits', async () => {
    const run = await runFix({
      issues: [
        issue({ file: 'src/a.ts', description: 'one' }),
        issue({ file: 'src/b.ts', description: 'two', category: 'security' }),
      ],
    });

    expect(run.called(/^reconcile:/)).toEqual([]);
    expect(run.result.fix.commits.map((commit) => commit.branch)).toEqual(['rrfix/wf_test/0', 'rrfix/wf_test/1']);

    // A single-finding commit keeps `applied`; only a merge turns findings into `conflict-resolved`.
    expect(run.result.fix.outcomes.map((outcome) => outcome.status)).toEqual(['applied', 'applied']);
  });
});
