/**
 * Schema fields the pipeline's later steps silently depend on. A schema is the only thing making a subagent report a
 * value at all, so a field dropped from one does not fail — it just arrives as `undefined` several steps later, where
 * nothing distinguishes "the agent said nothing" from "the agent said no".
 *
 * The `enum` vocabularies are pinned separately from the `required` lists, because a rename inside one regresses
 * independently: `required` only makes an agent answer, while the enum is what makes it answer with the one string this
 * script then compares against. Every other suite here has its fake agents return those strings directly and nothing in
 * them goes through the schema, so a rename ('applied' → 'committed', say) leaves the whole directory green while in
 * production no result satisfies the branch and teardown deletes every fix the run produced.
 */

import { describe, expect, it } from 'vitest';

import { internals } from './scenario.js';

describe('what the survey is required to answer', () => {
  it('includes the base commit, since nothing downstream can derive it', async () => {
    // A fix sandbox is not checked out at local `HEAD`, so `git rev-parse HEAD` inside one answers a different question,
    // and the ledger only records the commit that was *reviewed*. This agent is the sole source. Making the field
    // optional does not break a pin — it silently removes every fix from the run, since an unpinnable run refuses.
    const { SURVEY_SCHEMA } = await internals({});

    expect(SURVEY_SCHEMA.required).toEqual(['languages', 'tooling', 'entryPoints', 'headSha']);
    expect(SURVEY_SCHEMA.properties.headSha.description).toMatch(/git rev-parse HEAD/);
  });

  it('and nothing about how the repository is laid out, which only a review needs', async () => {
    // The review's survey also asks for `structure` and `inScopeFileCount`, because it has to partition the tree. This
    // one does not partition anything, and the answer is JSON-stringified into every fixer and every fix reviewer's
    // prompt — so a field no fixer reads is paid for once per agent, on the most expensive tier in the run.
    const { SURVEY_SCHEMA } = await internals({});

    expect(SURVEY_SCHEMA.properties.structure).toBeUndefined();
    expect(SURVEY_SCHEMA.properties.inScopeFileCount).toBeUndefined();
  });
});

describe('what a fixer and a fix reviewer are required to answer', () => {
  it('is an outcome and, with it, the stated reason a human reads', async () => {
    // Each is read as a pair: the outcome drives the pipeline, the prose is what the report shows. An optional
    // rationale would let an agent throw out a fix without saying anything at all.
    const { FIX_RESULT_SCHEMA, REVIEW_RESULT_SCHEMA } = await internals({});

    expect(FIX_RESULT_SCHEMA.required).toEqual(['status', 'reason']);
    expect(REVIEW_RESULT_SCHEMA.required).toEqual(['approved', 'objection']);
  });

  it('and the sandbox branch whatever the outcome, since teardown needs it', async () => {
    // The branch is created in step 0, before the fix is attempted, so a declined or failed fixer has still left one
    // behind. Asking for it only on success would leave those branches to survive the run.
    const { FIX_RESULT_SCHEMA } = await internals({});

    expect(FIX_RESULT_SCHEMA.properties.branch.description).toMatch(/whatever the outcome/);
  });
});

describe('the outcome vocabulary', () => {
  it('is the four things a fixer can report, and no more', async () => {
    // 'applied' is what the unsafe-path refusal, `keepBranches` and the final report all gate on; 'declined' and
    // 'verify-failed' are the refusals a fixer needs available to refuse at all; 'resolved-elsewhere' is the one that
    // retires a finding without a commit, and exists only because fixes are now based on current `HEAD` rather than on
    // the commit the review read — see `resolved-elsewhere.test.js` for what the wrapper does with it.
    const { FIX_RESULT_SCHEMA } = await internals({});

    expect(FIX_RESULT_SCHEMA.properties.status.enum).toEqual([
      'applied',
      'declined',
      'verify-failed',
      'resolved-elsewhere',
    ]);
  });

  it('does not include the statuses this script assigns itself', async () => {
    // `review-rejected` is what the run records for a fix its reviewers threw out. It is not a thing a fixer may claim:
    // offering it in the enum would let one self-report a rejection nobody voted on, and the branch-keeping rules read
    // that status as "reviewed and kept".
    const { FIX_RESULT_SCHEMA, STATUS_REVIEW_REJECTED } = await internals({});

    expect(FIX_RESULT_SCHEMA.properties.status.enum).not.toContain(STATUS_REVIEW_REJECTED);
  });
});
