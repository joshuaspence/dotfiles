/**
 * The instructions in the two prompts that decide what a branch contains, read as text.
 *
 * Everything else in this suite exercises the orchestration around these agents — which one is spawned, on what branch,
 * with what verdict counted. None of it can see whether the prompt still *says* the thing the orchestration is built on
 * top of. A fixer told to `git add -A` still returns `{ status: 'applied', sha, branch, changedFiles }`, every gate here
 * still passes it, and the branch table still recommends the commit; the only difference is that the commit now carries
 * the build output the verification step left behind. So the assertions below are not "the wording is unchanged" — they
 * are the handful of sentences some other invariant in this script is quietly relying on.
 *
 * The pin instruction is the third such sentence and has a suite of its own, `base-pinning.test.js`, because there is
 * more to it than its text.
 */

import { describe, expect, it } from 'vitest';

import { HEAD, REVIEWED, commitSha, internals, issue } from './scenario.js';

const survey = { languages: ['JavaScript'], tooling: 'npm test' };

// `fixerPrompt(issue, survey, base, reviewedCommit, branchSuffix, generatedPaths, revisionCtx)`. The suffix is the
// finding's index, as `runFixer` passes it; `generatedPaths` empty, since `branches.test.js` owns that block.
const fixer = async (revisionCtx = null) => {
  const { fixerPrompt } = await internals({});

  return fixerPrompt(issue(), survey, HEAD, REVIEWED, '0', [], revisionCtx);
};

const fixReview = async (over = {}) => {
  const { fixReviewPrompt } = await internals({});

  return fixReviewPrompt(issue(), { sha: commitSha(0), changedFiles: ['src/a.ts'], reason: 'fixed', ...over }, survey);
};

describe('what the fixer is told', () => {
  it('names the paths it may stage, and forbids the shorthand for all of them', async () => {
    // The whole reason this matters is one step earlier: step 3 runs the repository's own typecheck and tests inside the
    // sandbox, which routinely leaves coverage output, build artefacts and generated fixtures in the worktree. `git add
    // -A` would sweep those into the commit a reviewer is then asked to judge and a user is told to merge.
    const prompt = await fixer();

    expect(prompt).toContain('stage ONLY the files your fix edited');
    expect(prompt).toContain('git add -- <paths>');
    expect(prompt).toContain('never `git add -A`');
  });

  it('is told to verify in its own sandbox, and what to return when it cannot', async () => {
    // A fix that was never verified is the failure mode the review gate cannot catch: the reviewer is told not to run
    // the tests, so nothing downstream of here ever executes the change. The no-tooling branch matters as much as the
    // failure branch — without it, a repository with no test suite gets `verify-failed` on every fix.
    const prompt = await fixer();

    expect(prompt).toContain('verify in this worktree');
    expect(prompt).toContain('typecheck and run the tests');
    expect(prompt).toContain('`{ status: "verify-failed", reason }`');
    expect(prompt).toContain('no runnable typecheck or test suite');
  });

  it('is asked for every field the orchestrator reads off the result', async () => {
    // `sha` gates the review (a fix without one is downgraded), `branch` is what teardown deletes, and `changedFiles` is
    // both the reviewer's file list and the report's. A prompt that stopped asking for one of them would not fail — the
    // schema's `required` covers only `status` and `reason` — it would just start returning fixes with holes in them.
    const prompt = await fixer();

    expect(prompt).toContain('`{ status: "applied", sha, branch, changedFiles, reason }`');
    expect(prompt).toContain('`sha` from `git rev-parse HEAD`');
    expect(prompt).toContain('report it exactly, since it is what gets torn down afterwards');
    expect(prompt).toContain('must match the commit exactly');
  });

  it('is told to name the finding in a commit trailer, exactly as the ledger names it', async () => {
    // The only durable link from a branch back to the finding it answers. This script has no git access and learns a
    // branch name only from what the fixer returns, so a run killed before it reports leaves the trailer as the sole way
    // to tell which of `rrfix/*` fixes what — recoverable with `git log --all --grep` and no state file at all. Which is
    // why the value has to be the ledger's own fingerprint and the line has to carry nothing else.
    const { fingerprint, fixerPrompt, withFingerprint } = await internals({});
    const finding = withFingerprint(issue());
    const prompt = fixerPrompt(finding, survey, HEAD, REVIEWED, '0', []);

    expect(prompt).toContain(`Repo-Review-Finding: ${fingerprint(issue())}`);
    expect(prompt).toContain('Copy that identifier exactly, and put nothing else on the trailer line');
  });

  it('is told the finding may already be fixed, and that saying so is an answer', async () => {
    // Standalone, this command runs against a tree that has moved since the review, so "not there any more" is the
    // ordinary case rather than an edge one. Without a status for it, the honest answer costs the agent its `applied`
    // and it is cheaper to fix something adjacent — which is the failure this wording exists to head off.
    const prompt = await fixer();

    expect(prompt).toContain('confirm the issue is still present at this commit');
    expect(prompt).toContain('`{ status: "resolved-elsewhere", reason }`');
    expect(prompt).toContain('do not stretch to find something adjacent to fix');
  });

  it('is shown the rejected commit and told to start over from the base, not on top of it', async () => {
    // A revision that builds on the rejected commit inherits the diff the reviewers objected to, and the branch kept for
    // the user then contains both. The objection's own delivery — quoted, flattened — is `review-gate.test.js`.
    const prompt = await fixer({ priorSha: commitSha(9), objection: 'the null case is unhandled' });

    expect(prompt).toContain('This is a REVISION');
    expect(prompt).toContain('REJECTED');
    expect(prompt).toContain(`git show ${commitSha(9)}`);
    expect(prompt).toContain('starting fresh from the base commit, not building on the rejected commit');
  });
});

describe('what the fix reviewer is told', () => {
  it('is pointed at the commit itself rather than at the fixer’s account of it', async () => {
    // This is the only agent in the run that reads the diff. Judging the fixer's `reason` instead would make the gate a
    // vote on whether the fixer sounded confident.
    const prompt = await fixReview();

    expect(prompt).toContain(`git show ${commitSha(0)}`);
    expect(prompt).toContain('Inspect the change read-only');
    expect(prompt).toContain('do NOT trust the fixer');
    expect(prompt).toContain('Judge that commit independently');
  });

  it('is asked to judge both that the fix works and that it is confined to the issue', async () => {
    // Correctness alone would approve a change that fixes the finding and refactors two modules on the way past —
    // landable-looking, and the widest diff in the branch table.
    const prompt = await fixReview();

    expect(prompt).toContain('correctness');
    expect(prompt).toContain('quality');
    expect(prompt).toContain('minimal');
    expect(prompt).toContain('no new bugs');
    expect(prompt).toContain('Approve only if you are confident on both');
  });

  it('is told to keep its hands off the checkout it is reading', async () => {
    // Unlike every other agent here, this one runs un-isolated in the user's live tree. Running the tests would leave
    // artefacts the user has to sort out by hand, and nothing in this run would clean up after it.
    const prompt = await fixReview();

    expect(prompt).toContain('do not modify, create, or delete any file');
    expect(prompt).toContain('do not build, typecheck, lint, or test the repository');
    expect(prompt).toContain('The fixer already ran the tests in its own sandbox');
  });

  it('is asked for an objection a reviser could act on, and for the shape the gate counts', async () => {
    // A rejection is not the end of a fix — it is the input to one more attempt. An objection that only says "no" costs
    // an Opus agent that has nothing to work from, which is why the fallback in the gate has to exist at all.
    const prompt = await fixReview();

    expect(prompt).toContain('specific, actionable objection');
    expect(prompt).toContain('fixer can act on');
    expect(prompt).toContain('Return `{ approved, objection }`');
  });

  it('says which files the commit touches, or says that nothing was reported', async () => {
    // The list is the reviewer's map of what to read beside the `git show`. An empty one rendered as nothing at all
    // reads as a commit that touched no files, which is a different claim from a fixer that did not say.
    expect(await fixReview()).toContain('files: src/a.ts');
    expect(await fixReview({ changedFiles: [] })).toContain('files: (none reported)');
    expect(await fixReview({ changedFiles: undefined })).toContain('files: (none reported)');
  });
});
