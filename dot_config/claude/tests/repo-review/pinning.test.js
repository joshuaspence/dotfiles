/**
 * Base pinning.
 *
 * `isolation: 'worktree'` does not check a sandbox out at the repository's local `HEAD`; it creates the sandbox branch
 * at the *remote* default branch. In the run that prompted this, all 81 sandboxes sat 126 commits behind the `HEAD` the
 * reviewers had read, so the fixers edited stale source and returned commits on four different bases. The script has no
 * git access, so the only defence is the instruction it sends and the SHA it refuses to proceed without.
 */

import { describe, expect, it } from 'vitest';

import { HEAD, STALE, commitSha, internals, issue, runFix } from './scenario.js';

describe('the pin instruction', () => {
  it('tells the fixer to branch at the reviewed commit and to verify it took', async () => {
    const run = await runFix();
    const [fixer] = run.called(/^fix:/);

    expect(fixer.prompt).toContain(`git switch -c rrfix/<RUN>/0 ${HEAD}`);
    expect(fixer.prompt).toContain(`\`git rev-parse HEAD\` must print exactly \`${HEAD}\``);
  });

  it('does not claim the sandbox is already at HEAD', async () => {
    // The prompt used to assert this. It was false, and it was worse than saying nothing: a few fixers noticed the
    // mismatch and re-based themselves while most trusted the claim, which is how one run produced four bases.
    const run = await runFix();
    const [fixer] = run.called(/^fix:/);

    expect(fixer.prompt).not.toContain('checked out at the repository');
    expect(fixer.prompt).toContain('Your worktree is **not** checked out at the commit under review');
  });

  it('has the fixer re-check its commit parent before returning', async () => {
    // Verifying the pin at the start is not enough on its own: anything the fixer does in between can move HEAD, and a
    // commit on the wrong base is the one failure the wrapper cannot recover from mid-sequence.
    const run = await runFix();
    const [fixer] = run.called(/^fix:/);

    expect(fixer.prompt).toContain(`\`git rev-parse HEAD~1\` must still print \`${HEAD}\``);
  });

  it('pins revisions too, on their own branch', async () => {
    const run = await runFix({ reviewFix: () => ({ approved: false, objection: 'misses a case' }) });
    const [revision] = run.called(/^revise:/);

    expect(revision.prompt).toContain(`git switch -c rrfix/<RUN>/0-r1 ${HEAD}`);
  });

  it('pins the reconciler, under its own branch prefix', async () => {
    const run = await runFix({
      issues: [issue({ file: 'src/a.ts' }), issue({ file: 'src/a.ts', description: 'a second finding there' })],
    });
    const [reconciler] = run.called(/^reconcile:/);

    expect(reconciler.prompt).toContain(`git switch -c rrmerge/<RUN>/0 ${HEAD}`);
  });

  it('derives the run scope from the sandbox branch by one rule every agent can follow', async () => {
    // The prefix cannot come from the script — it has no handle on the workflow id — so each agent derives it from its
    // own sandbox branch name. The rule has to be mechanical: an earlier wording ("extract the wf_<id> token") admitted
    // two different answers, and agents that disagreed would have put their branches outside the wrapper's teardown.
    const { pinToReviewHead } = await internals();
    const instruction = pinToReviewHead(HEAD, 'rrfix', '3', 'give up');

    expect(instruction).toContain('stripping the leading `worktree-` and the trailing `-<agentNumber>`');
    expect(instruction).toContain('every agent in this run must derive the *same* `<RUN>`');
  });
});

describe('capturing the reviewed commit', () => {
  it('reports the surveyed commit as the base the wrapper must cherry-pick onto', async () => {
    const run = await runFix();

    expect(run.result.fix.base).toBe(HEAD);
    expect(run.logged('Reviewing at cd976db1f0')).toBe(true);
  });

  it('re-asks a single question when the survey drops the SHA', async () => {
    // The surveyor is a Haiku agent answering a long structured question, so it does occasionally omit one field.
    // That is not worth throwing the whole `--fix` run away for.
    const run = await runFix({ survey: { headSha: '' }, headOnly: { headSha: HEAD } });

    expect(run.called('review-head')).toHaveLength(1);
    expect(run.result.fix.base).toBe(HEAD);
    expect(run.called(/^fix:/)).toHaveLength(1);
  });

  it.each([
    ['a branch name', 'master'],
    ['a shell injection', 'HEAD; rm -rf /'],
    ['an empty string', ''],
    ['a non-hex string', 'not-a-sha-at-all'],
  ])('rejects %s and falls back to the direct question', async (_label, headSha) => {
    // The SHA is interpolated into the `git switch` line of every downstream prompt, so it is untrusted input.
    const run = await runFix({ survey: { headSha }, headOnly: { headSha: HEAD } });

    expect(run.called('review-head')).toHaveLength(1);
    expect(run.result.fix.base).toBe(HEAD);
  });

  it('accepts a short object name', async () => {
    const run = await runFix({ survey: { headSha: 'cd976db' } });

    expect(run.called('review-head')).toHaveLength(0);
    expect(run.result.fix.base).toBe('cd976db');
  });
});

describe('when the reviewed commit cannot be determined at all', () => {
  const unpinnable = () => runFix({ survey: { headSha: '' }, headOnly: null });

  it('refuses to run the Fix phase', async () => {
    // Refusing is the honest outcome. Running unpinned costs the trustworthiness of the whole result: the fixers would
    // edit whatever the remote default branch holds and hand the wrapper commits it is told are conflict-free.
    const run = await unpinnable();

    expect(run.called(/^fix:/)).toHaveLength(0);
    expect(run.called(/^reconcile:/)).toHaveLength(0);
    expect(run.result.fix).toBeUndefined();
  });

  it('still reports the findings, and says they are not verified as unfixable', async () => {
    const run = await unpinnable();
    const gap = run.result.gaps.find((entry) => entry.includes('Fix phase did **not** run'));

    expect(run.result.findings).toHaveLength(1);
    expect(gap).toBeDefined();
    expect(gap).toContain('not** verified as unfixable');
  });
});

describe('the reviewed commit reaches every prompt that needs it', () => {
  it('never leaks the stale base into an instruction', async () => {
    // A cheap whole-run guard: STALE stands in for the remote default branch. Nothing the script composes should ever
    // name it, since it only ever learns the surveyed SHA.
    const run = await runFix({
      issues: [issue({ file: 'src/a.ts' }), issue({ file: 'src/a.ts', description: 'a second finding there' })],
      fix: (subject, { idx }) => ({
        status: 'applied',
        sha: commitSha(idx),
        branch: `rrfix/wf_test/${idx}`,
        changedFiles: ['src/a.ts'],
        reason: 'fixed',
      }),
    });

    expect(run.calls.filter((call) => call.prompt.includes(STALE))).toEqual([]);
    expect(run.called(/^(fix|reconcile):/).every((call) => call.prompt.includes(HEAD))).toBe(true);
  });
});
