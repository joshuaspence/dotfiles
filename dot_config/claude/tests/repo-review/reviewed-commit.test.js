/**
 * The commit the findings are anchored to, and the fact that nothing here is checked out anywhere else.
 *
 * `reviewedCommit` is the only thing this workflow says about git. The wrapper cites every finding as a permalink into the
 * reviewed tree and persists the SHA to the ledger, where `/repo-review-fix` reads it to tell its fixers how far the tree
 * has drifted since. Both of those consumers are downstream of a string one Haiku agent reported, so the value is checked
 * on the way through rather than trusted: it is `git`-command-line input at the far end, and an abbreviation would name
 * the right commit while failing every equality check made against it.
 *
 * The other half is a negative. This command reads and does not write, which is enforced by there being no
 * `isolation: 'worktree'` anywhere in it — a fact no passing run's output would reveal, and one that a single copied
 * `opts` object would quietly reverse.
 */

import { describe, expect, it } from 'vitest';

import { HEAD, internals, issue, runReview } from './scenario.js';

describe('reporting the reviewed commit', () => {
  it('returns the surveyed commit, and says so in the log', async () => {
    const run = await runReview();

    expect(run.result.reviewedCommit).toBe(HEAD);
    expect(run.logged(`Reviewing at ${HEAD.slice(0, 10)}`)).toHaveLength(1);
  });

  it('returns it from an aborted run too, so the field is on every exit the wrapper can see', async () => {
    // The wrapper writes the ledger from whatever comes back. A run that died at the Partition phase still reviewed a
    // specific tree, and dropping the SHA on that path would leave the ledger unable to say which one.
    const run = await runReview({ units: [] });

    expect(run.result.reviewedCommit).toBe(HEAD);
    expect(run.result.gaps.join(' ')).toContain('Partition agent did not return');
  });

  it('canonicalises the case `git rev-parse` prints, rather than discarding the answer', async () => {
    // A full-length answer in upper case is the SHA, just not spelled the way git echoes it. Lower-casing it keeps the
    // string comparison a fix sandbox verifies its pin with meaningful, at no cost.
    const run = await runReview({ survey: { headSha: HEAD.toUpperCase() } });

    expect(run.result.reviewedCommit).toBe(HEAD);
  });
});

describe('a survey that did not report a usable commit', () => {
  it.each([
    ['omitted it', ''],
    ['answered with a branch name', 'master'],
    ['answered with a shell injection', 'HEAD; rm -rf /'],
    ['answered with a non-hex string', 'not-a-sha-at-all'],
    ['abbreviated it', 'cd976db'],
  ])('reports no commit when the survey %s', async (_label, headSha) => {
    // An abbreviation is refused for a reason the others do not share: it names the right commit. It is refused anyway,
    // because every consumer compares it rather than resolving it — the wrapper decides whether a later round's tree has
    // moved by testing this string against the new one, and `/repo-review-fix` decides whether to warn a fixer about
    // drift the same way. A short name never matches a full one, so it reads as permanent drift, forever.
    const run = await runReview({ survey: { headSha } });

    expect(run.result.reviewedCommit).toBeNull();
    expect(run.logged('Reviewing at')).toHaveLength(0);
  });

  it('says so as a gap, because an unanchored finding cannot be cited', async () => {
    // The findings themselves are unaffected — nothing about reviewing a file depends on naming the commit it sat in — so
    // this is a shortfall in what can be *reported*, and it has to be said rather than inferred from a null field the
    // wrapper might not check.
    const run = await runReview({ survey: { headSha: '' } });
    const [gap] = run.result.gaps.filter((entry) => /not anchored to a commit/.test(entry));

    expect(run.result.findings).toHaveLength(1);
    expect(gap).toContain('`reviewedCommit` is empty');
    expect(gap).toContain('The findings themselves stand');
  });

  it('accepts nothing short of a full object name, whichever case it arrives in', async () => {
    const { fullCommitSha } = await internals();

    expect(fullCommitSha(HEAD)).toBe(HEAD);
    expect(fullCommitSha(HEAD.toUpperCase())).toBe(HEAD);
    expect(fullCommitSha(HEAD.slice(0, 7))).toBeNull();
    expect(fullCommitSha(`${HEAD}0`)).toBeNull();
    expect(fullCommitSha(undefined)).toBeNull();
  });
});

describe('the checkout every phase runs in', () => {
  it('is the user’s own, since no agent here asks for a worktree', async () => {
    // `isolation: 'worktree'` is what a committing agent needs, and this command has none: the reviewers, the lenses, the
    // dedupe agents and the validators all read. Asserted over a run with enough shape to reach every phase, and stated
    // as "which agents asked" rather than a boolean so a failure names the one that did.
    const run = await runReview({
      issues: [issue({ file: 'src/a.ts' }), issue({ file: 'src/b.ts', category: 'security' })],
    });

    expect(run.calls.length).toBeGreaterThan(0);
    expect(run.calls.filter((call) => call.opts.isolation !== undefined).map((call) => call.label)).toEqual([]);
  });
});
