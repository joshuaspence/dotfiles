/**
 * Base pinning.
 *
 * `isolation: 'worktree'` does not check a sandbox out at the repository's local `HEAD`; it creates the sandbox branch
 * at the *remote* default branch. In the run that prompted this, all 81 sandboxes sat 126 commits behind the `HEAD` the
 * reviewers had read, so the fixers edited stale source and returned commits on four different bases. The script has no
 * git access, so the only defence is the instruction it sends and the SHA it refuses to proceed without.
 */

import { describe, expect, it } from 'vitest';

import { HEAD, commitSha, internals, issue, runFix } from './scenario.js';

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

  it('derives the run scope from the sandbox branch by one rule every agent can follow', async () => {
    // The prefix cannot come from the script — it has no handle on the workflow id — so each agent derives it from its
    // own sandbox branch name. The rule has to be mechanical: an earlier wording ("extract the wf_<id> token") admitted
    // two different answers, and agents that disagreed would have put their branches outside the wrapper's teardown.
    const { pinToReviewHead } = await internals();
    const instruction = pinToReviewHead(HEAD, 'rrfix', '3', 'give up');

    expect(instruction).toContain('stripping the leading `worktree-` and the trailing `-<agentNumber>`');
    expect(instruction).toContain('every agent in this run must derive the *same* `<RUN>`');
  });

  it('gives the derivation as a command, because agents asked to do it in their heads got it wrong', async () => {
    // Prose alone did not hold: in one run 49 agents reported `rrfix/undefined/<n>` and one stripped only the prefix,
    // keeping the agent number. Both produce a real branch under an id no other agent shares, which is outside the
    // pattern teardown can derive for the matching `worktree-<run-id>-<n>` ref.
    const { pinToReviewHead } = await internals();
    const instruction = pinToReviewHead(HEAD, 'rrfix', '3', 'give up');

    // Two substitutions rather than a backreference: this script is compiled with `new Function`, so it runs sloppy-mode
    // where a `'\1'` in a single-quoted JS string is a legacy octal escape and would ship a literal U+0001 to the agent.
    expect(instruction).toContain("sed -E 's/^worktree-//; s/-[0-9]+$//'");
    expect(instruction).not.toContain('\u0001');
  });

  it('forbids naming a branch after a value the agent never read', async () => {
    const { pinToReviewHead } = await internals();
    const instruction = pinToReviewHead(HEAD, 'rrfix', '3', 'give up');

    expect(instruction).toContain('Never put the word `undefined`, `null`, or an empty segment in a branch name.');
    // Declining is the safe direction: a fix is lost, but no unreachable branch is created.
    expect(instruction).toContain('do not guess a placeholder');
  });
});

describe('the sandbox the pin is applied inside', () => {
  // `isolation: 'worktree'` is the entire containment story for the agents that hold Edit and run `git switch -c` /
  // `git add` / `git commit`. Deleting it would turn N concurrent fixers loose on the user's live checkout, branching
  // and committing in it — and every prompt assertion above reads identically either way, so without these two tests
  // nothing in the suite would notice.
  const COMMITTING = /^(fix|revise):/;

  // One run that reaches both kinds: two findings, and rejecting finding 0's first attempt adds a reviser. The two
  // findings deliberately sit in the same file, which is the case a fix run now simply allows — each gets its own branch
  // and the overlap is the user's to resolve if they ever merge both.
  const busy = () =>
    runFix({
      issues: [issue({ file: 'src/a.ts' }), issue({ file: 'src/a.ts', description: 'a second finding there' })],
      reviewFix: (_subject, { idx, attempt }) =>
        idx === 0 && attempt === 0
          ? { approved: false, objection: 'misses a case' }
          : { approved: true, objection: '' },
    });

  it('is requested by every fixer and reviser', async () => {
    const run = await busy();
    const committing = run.called(COMMITTING);

    // Count them first: a renamed label would otherwise leave the loop below iterating an empty list and passing.
    expect(run.called(/^fix:/)).toHaveLength(2);
    expect(run.called(/^revise:/)).toHaveLength(1);
    expect(committing).toHaveLength(3);

    for (const call of committing) {
      expect(call.opts.isolation).toBe('worktree');
    }
  });

  it('is requested by nothing else in that run, every other agent being read-only', async () => {
    const run = await busy();
    const stray = run.calls.filter((call) => !COMMITTING.test(call.label) && call.opts.isolation !== undefined);

    expect(stray.map((call) => call.label)).toEqual([]);
  });

  it('is not requested anywhere by a review that cannot commit', async () => {
    const run = await runFix({ args: { fix: false } });

    expect(run.calls.length).toBeGreaterThan(0);
    expect(run.calls.filter((call) => call.opts.isolation !== undefined).map((call) => call.label)).toEqual([]);
  });
});

describe('capturing the reviewed commit', () => {
  it('reports the surveyed commit as the base the wrapper diffs every branch against', async () => {
    const run = await runFix();

    expect(run.result.fix.base).toBe(HEAD);
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
    ['an abbreviated object name', 'cd976db'],
  ])('rejects %s and falls back to the direct question', async (_label, headSha) => {
    // The SHA is interpolated into the `git switch` line of every downstream prompt, so it is untrusted input. An
    // abbreviation is rejected for a second reason: every agent verifies its pin by comparing `git rev-parse HEAD`
    // against this string, and the wrapper's pre-flight compares it to `fix.base`, so a 7-character base pins the
    // branch correctly and then fails that comparison forever — every fixer declines at step 0 and the phase produces
    // nothing. Re-asking costs one Haiku call; accepting it costs the whole `--fix` phase.
    const run = await runFix({ survey: { headSha }, headOnly: { headSha: HEAD } });

    expect(run.called('review-head')).toHaveLength(1);
    expect(run.result.fix.base).toBe(HEAD);
    expect(run.logged('Reviewing at')).toHaveLength(0);
  });

  it('canonicalises the case `git rev-parse` prints, rather than re-asking', async () => {
    // A full-length answer in upper case is the SHA, just not spelled the way git echoes it. Lower-casing it keeps the
    // string comparison in the pin instruction meaningful without spending a re-ask that could come back the same way.
    const run = await runFix({ survey: { headSha: HEAD.toUpperCase() } });

    expect(run.called('review-head')).toHaveLength(0);
    expect(run.result.fix.base).toBe(HEAD);
  });
});

describe('reporting the reviewed commit to the wrapper', () => {
  // The wrapper cites every finding as a permalink into the reviewed tree. It used to be told to obtain that SHA with
  // its own `git rev-parse HEAD`, which is a second source of truth for a fact this script already holds and validates
  // — and one free to disagree, since a long run can outlive the `HEAD` it started on.
  it('returns it on the read-only path, where there is no `fix` object to carry it', async () => {
    const run = await runFix({ args: { fix: false } });

    expect(run.result.reviewedCommit).toBe(HEAD);
    expect(run.result.fix).toBeUndefined();
  });

  it('returns it alongside `fix.base`, which is the same commit', async () => {
    const run = await runFix();

    expect(run.result.reviewedCommit).toBe(HEAD);
    expect(run.result.fix.base).toBe(run.result.reviewedCommit);
  });

  it('returns it from an aborted run too, so the field is on every exit the wrapper can see', async () => {
    const run = await runFix({ units: [] });

    expect(run.result.reviewedCommit).toBe(HEAD);
    expect(run.result.gaps.join(' ')).toContain('Partition agent did not return');
  });

  it('is null when the script never learned it, so the wrapper knows to ask git itself', async () => {
    const run = await runFix({ survey: { headSha: '' }, headOnly: null });

    expect(run.result.reviewedCommit).toBeNull();
  });
});

describe('when the reviewed commit cannot be determined at all', () => {
  const unpinnable = () => runFix({ survey: { headSha: '' }, headOnly: null });

  it('refuses to run the Fix phase', async () => {
    // Refusing is the honest outcome. Running unpinned costs the trustworthiness of the whole result: the fixers would
    // edit whatever the remote default branch holds and hand the wrapper branches whose diffs answer no live finding.
    const run = await unpinnable();

    expect(run.called(/^fix:/)).toHaveLength(0);
    expect(run.result.fix).toBeUndefined();
  });

  it('still reports the findings, and says they are not verified as unfixable', async () => {
    const run = await unpinnable();
    const gap = run.result.gaps.find((entry) => entry.includes('Fix phase did **not** run'));

    expect(run.result.findings).toHaveLength(1);
    expect(gap).toBeDefined();
    expect(gap).toContain('not** verified as unfixable');
  });

  it.each([
    ['a branch name', 'master'],
    ['a shell injection', 'HEAD; rm -rf /'],
    ['an empty string', ''],
    ['a non-hex string', 'not-a-sha-at-all'],
  ])('refuses just the same when the re-ask answers with %s', async (_label, headSha) => {
    // The re-ask is the second, independent source of the SHA interpolated into the `git switch` line of every sandbox
    // prompt, and the one likeliest to answer badly: a Haiku agent at low effort whose prompt has to spell out "do not
    // substitute a branch name". Its answer is untrusted for the same reason the survey's is, so it is guarded the same
    // way — a bad answer here is a run that cannot be pinned, not a value to pass on.
    const run = await runFix({ survey: { headSha: '' }, headOnly: { headSha } });

    expect(run.called('review-head')).toHaveLength(1);
    expect(run.called(/^fix:/)).toHaveLength(0);
    expect(run.result.fix).toBeUndefined();
  });
});

describe('the reviewed commit reaches every prompt that needs it', () => {
  it('pins the branch of every agent that commits, not just the first of each kind', async () => {
    // The tests above check one fixer and one reviser; this checks that nothing composing a `git switch` line is
    // left out — the second fixer included. Both halves have to be falsifiable to be worth having: the expected calls
    // are named so a filtered assertion cannot pass by matching nothing, and the pin is matched on the `git switch`
    // line rather than on a bare mention of the SHA, which the survey block appended to every prompt carries anyway.
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
    const branching = run.called(/^fix:/);
    const pinned = new RegExp(`git switch -c \\S+ ${HEAD}\``);

    expect(branching.map((call) => call.label)).toEqual(['fix:bug#0', 'fix:bug#1']);
    expect(branching.filter((call) => !pinned.test(call.prompt)).map((call) => call.label)).toEqual([]);
  });
});
