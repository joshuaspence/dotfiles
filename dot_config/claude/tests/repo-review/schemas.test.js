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
});
