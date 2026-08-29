/**
 * Schema fields the pipeline's later phases silently depend on. A schema is the only thing making a subagent report a
 * value at all, so a field dropped from one does not fail — it just arrives as `undefined` several phases later.
 */

import { describe, expect, it } from 'vitest';

import { internals } from './scenario.js';

describe('schemas', () => {
  it('requires the surveyor to return the reviewed commit', async () => {
    // The whole `--fix` pipeline is pinned to this one value, and the survey is the only agent that runs before a
    // worktree exists — so it is the only place it can come from. Making it optional silently disables pinning.
    const { SURVEY_SCHEMA } = await internals();

    expect(SURVEY_SCHEMA.required).toContain('headSha');
    expect(SURVEY_SCHEMA.properties.headSha.description).toMatch(/git rev-parse HEAD/);
  });

  it('asks for the sandbox branch whatever the outcome, since teardown needs it', async () => {
    // A declined fixer still created a branch in step 0. If the schema only asked for it on success, the branch would
    // survive the run and the next one would trip over it.
    const { FIX_RESULT_SCHEMA, RECONCILE_RESULT_SCHEMA } = await internals();

    for (const schema of [FIX_RESULT_SCHEMA, RECONCILE_RESULT_SCHEMA]) {
      expect(schema.properties.branch.description).toMatch(/whatever the outcome/);
    }
  });

  it('enforces required fields critical to the pipeline', async () => {
    // Schemas are the only mechanism making agents return required fields. A field dropped from a schema arrives as
    // `undefined` several phases later, causing silent failures.
    const {
      ISSUES_SCHEMA,
      SURVEY_SCHEMA,
      PARTITION_SCHEMA,
      VERDICT_SCHEMA,
      DEDUPE_SCHEMA,
      FIX_RESULT_SCHEMA,
      RECONCILE_RESULT_SCHEMA,
      REVIEW_RESULT_SCHEMA,
    } = await internals();

    // ISSUES_SCHEMA must require the issues array, and each issue must require its core fields
    expect(ISSUES_SCHEMA.required).toContain('issues');
    const issueSchema = ISSUES_SCHEMA.properties.issues.items;
    expect(issueSchema.required).toEqual(['description', 'severity', 'category', 'file', 'reason']);

    // SURVEY_SCHEMA must require all fields the downstream phases depend on
    expect(SURVEY_SCHEMA.required).toEqual([
      'languages',
      'tooling',
      'entryPoints',
      'inScopeFileCount',
      'structure',
      'headSha',
    ]);
    // Each structure item must have path and fileCount
    const structureSchema = SURVEY_SCHEMA.properties.structure.items;
    expect(structureSchema.required).toEqual(['path', 'fileCount']);

    // PARTITION_SCHEMA must require units and exclusions, and their nested items must have their required fields
    expect(PARTITION_SCHEMA.required).toEqual(['units', 'exclusions']);
    const unitSchema = PARTITION_SCHEMA.properties.units.items;
    expect(unitSchema.required).toEqual(['name', 'paths']);
    const exclusionSchema = PARTITION_SCHEMA.properties.exclusions.items;
    expect(exclusionSchema.required).toEqual(['path', 'reason']);

    // VERDICT_SCHEMA must require both fields validators return
    expect(VERDICT_SCHEMA.required).toEqual(['confirmed', 'rationale']);

    // DEDUPE_SCHEMA must require the groups array
    expect(DEDUPE_SCHEMA.required).toEqual(['groups']);

    // FIX_RESULT_SCHEMA and RECONCILE_RESULT_SCHEMA must require status and reason
    expect(FIX_RESULT_SCHEMA.required).toEqual(['status', 'reason']);
    expect(RECONCILE_RESULT_SCHEMA.required).toEqual(['status', 'reason']);

    // REVIEW_RESULT_SCHEMA must require approved and objection
    expect(REVIEW_RESULT_SCHEMA.required).toEqual(['approved', 'objection']);
  });
});
