/**
 * Schema fields the pipeline's later phases silently depend on. A schema is the only thing making a subagent report a
 * value at all, so a field dropped from one does not fail — it just arrives as `undefined` several phases later.
 *
 * Each schema's required list has exactly one owner here; the `enum` vocabularies are pinned separately, since a
 * rename inside one regresses independently of the required list. `DEDUPE_SCHEMA` is the exception: it is owned by
 * `dedupe.test.js`, next to the round logic that reads what it returns.
 *
 * The schemas the fix agents answer against live with that command, in `tests/repo-review-fix/schemas.test.js`.
 */

import { describe, expect, it } from 'vitest';

import { internals } from './scenario.js';

describe('schemas', () => {
  it('requires the surveyor to return the reviewed commit, plus everything the later phases read', async () => {
    // `headSha` is what every finding this run reports is anchored to, and the survey is the only agent asked for it —
    // so making it optional does not degrade the review, it just leaves the whole round uncitable.
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
    // `generated` is required, not optional: the flag travels — the wrapper persists it to the ledger and
    // `/repo-review-fix` reads it to name the paths its fix agents must never stage. A partitioner omitting it would
    // leave every later fixer free to commit a regenerated bundle, one command away from where the omission happened.
    expect(PARTITION_SCHEMA.properties.exclusions.items.required).toEqual(['path', 'reason', 'generated']);
  });

  it('requires both a verdict and its stated reason from the agents that judge', async () => {
    // The three are read together: `index` says which finding the verdict is about, the verdict drives the pipeline, and
    // the prose is what a human reads to see why. An optional rationale would let an adjudicator kill a finding without
    // saying anything at all, and an optional index would leave a verdict attached to nothing.
    const { ADJUDICATION_SCHEMA } = await internals();

    expect(ADJUDICATION_SCHEMA.required).toEqual(['groups', 'verdicts']);
    expect(ADJUDICATION_SCHEMA.properties.verdicts.items.required).toEqual(['index', 'confirmed', 'rationale']);
  });

  it('asks an adjudicator for its merge in exactly the words the cross-unit pass is asked in', async () => {
    // `globalizeGroups` can only drop an index outside the range an agent was shown, and every wrong index inside that
    // range is also a valid one — so a stage whose merge contract had drifted would silently collapse unrelated findings
    // rather than failing. Shared by reference for that reason, and asserted so that inlining it again is a test failure.
    const { ADJUDICATION_SCHEMA, DEDUPE_SCHEMA } = await internals();

    expect(ADJUDICATION_SCHEMA.properties.groups).toBe(DEDUPE_SCHEMA.properties.groups);
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

    // Category is not free text either: it selects the validation tier through `HIGH_RISK`, and the reviewer that
    // reported a finding is told to return its own key. So the enum has to be exactly the roster of keys plus the
    // whole-repo lenses' single category, which is the one they are all instructed to report under.
    expect(issueSchema.properties.category.enum).toEqual([
      'architecture',
      ...REVIEWERS.map((reviewer) => reviewer.key),
    ]);
  });
});
