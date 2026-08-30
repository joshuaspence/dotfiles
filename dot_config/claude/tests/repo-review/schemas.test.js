/**
 * Schema fields the pipeline's later phases silently depend on. A schema is the only thing making a subagent report a
 * value at all, so a field dropped from one does not fail — it just arrives as `undefined` several phases later.
 *
 * Each schema's required list has exactly one owner here; the `enum` vocabularies are pinned separately, since a
 * rename inside one regresses independently of the required list. `DEDUPE_SCHEMA` is the exception: it is owned by
 * `dedupe.test.js`, next to the round logic that reads what it returns.
 */

import { describe, expect, it } from 'vitest';

import { internals } from './scenario.js';

describe('schemas', () => {
  it('requires the surveyor to return the reviewed commit, plus everything the later phases read', async () => {
    // The whole `--fix` pipeline is pinned to `headSha`, and the survey is the only agent that runs before a worktree
    // exists — so it is the only place it can come from. Making it optional silently disables pinning.
    const { SURVEY_SCHEMA } = await internals();

    expect(SURVEY_SCHEMA.required).toEqual([
      'languages',
      'tooling',
      'entryPoints',
      'inScopeFileCount',
      'structure',
      'headSha',
    ]);
    expect(SURVEY_SCHEMA.properties.headSha.description).toMatch(/git rev-parse HEAD/);
    // Each structure item must have path and fileCount
    expect(SURVEY_SCHEMA.properties.structure.items.required).toEqual(['path', 'fileCount']);
  });

  it('asks for the sandbox branch whatever the outcome, since teardown needs it', async () => {
    // A declined fixer still created a branch in step 0. If the schema only asked for it on success, the branch would
    // survive the run and the next one would trip over it.
    const { FIX_RESULT_SCHEMA } = await internals();

    expect(FIX_RESULT_SCHEMA.properties.branch.description).toMatch(/whatever the outcome/);
  });

  it('requires the issues array, and of each issue the fields every later phase reads', async () => {
    const { ISSUES_SCHEMA } = await internals();

    expect(ISSUES_SCHEMA.required).toContain('issues');
    expect(ISSUES_SCHEMA.properties.issues.items.required).toEqual([
      'description',
      'severity',
      'category',
      'file',
      'reason',
    ]);
  });

  it('requires the partitioner to flag which exclusions are generated', async () => {
    const { PARTITION_SCHEMA } = await internals();

    expect(PARTITION_SCHEMA.required).toEqual(['units', 'exclusions']);
    expect(PARTITION_SCHEMA.properties.units.items.required).toEqual(['name', 'paths']);
    // `generated` is required, not optional: it is how the Fix phase names the paths a fixer must never stage, so a
    // partitioner omitting it would silently leave every fixer free to commit a regenerated bundle.
    expect(PARTITION_SCHEMA.properties.exclusions.items.required).toEqual(['path', 'reason', 'generated']);
  });

  it('requires both an outcome and its stated reason from every agent that judges', async () => {
    // Each of these is read as a pair: the outcome drives the pipeline, the prose is what a human reads to see why. An
    // optional rationale would let an agent kill a finding, or a fix, without saying anything at all.
    const { VERDICT_SCHEMA, FIX_RESULT_SCHEMA, REVIEW_RESULT_SCHEMA } = await internals();

    expect(VERDICT_SCHEMA.required).toEqual(['confirmed', 'rationale']);
    expect(FIX_RESULT_SCHEMA.required).toEqual(['status', 'reason']);
    expect(REVIEW_RESULT_SCHEMA.required).toEqual(['approved', 'objection']);
  });

  it('pins the outcome vocabulary the Fix phase branches on', async () => {
    // `required` only makes an agent answer; the `enum` is what makes it answer with the one string the pipeline then
    // compares against. The phase decides which branches to keep by string equality on `status`, and every other test in
    // this suite has its fake agents return those strings directly — nothing there goes through the schema. So a rename
    // inside the enum ('applied' → 'committed', say, or dropping 'verify-failed') leaves the whole suite green while in
    // production no result ever satisfies the branch and teardown deletes every fix the run produced.
    const { FIX_RESULT_SCHEMA } = await internals();

    // 'applied' is the one the phase gates the unsafe-path refusal, `keepBranches` and the final report on; the other
    // two are the refusals a fixer needs available to decline at all.
    expect(FIX_RESULT_SCHEMA.properties.status.enum).toEqual(['applied', 'declined', 'verify-failed']);
  });

  it('keeps a finding’s severity and category vocabularies aligned with what consumes them', async () => {
    const { ISSUES_SCHEMA, REVIEWERS, SEVERITY_ORDER } = await internals();
    const issueSchema = ISSUES_SCHEMA.properties.issues.items;

    // `SEVERITY_ORDER` is a second, hand-maintained copy of this vocabulary, and `worstSeverity` merges a duplicate
    // group's severity by indexing into it. A value offered to reviewers that is missing there compares as
    // `indexOf() === -1` — below every real severity — so a `critical` duplicate silently merges down to the unknown
    // value instead of up. Asserted as a set in both directions: the ranking is what the order means, and an entry in
    // `SEVERITY_ORDER` that no reviewer can return is dead weight that reads as if it ranks something.
    expect([...issueSchema.properties.severity.enum].sort()).toEqual([...SEVERITY_ORDER].sort());

    // Category is not free text either: it selects the validator/fixer tier through `HIGH_RISK`, and the reviewer that
    // reported a finding is told to return its own key. So the enum has to be exactly the roster of keys plus the
    // whole-repo lenses' single category, which is the one they are all instructed to report under.
    expect(issueSchema.properties.category.enum).toEqual([
      'architecture',
      ...REVIEWERS.map((reviewer) => reviewer.key),
    ]);
  });
});
