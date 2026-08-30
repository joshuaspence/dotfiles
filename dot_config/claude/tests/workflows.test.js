/**
 * Invariants every workflow script must satisfy to be loadable by the `Workflow` tool at all.
 *
 * These are the properties whose violation makes a script fail at launch, where the only feedback is a dead run — so
 * they are checked for every script in the source directory, including ones added after this file was written.
 */

import { describe, expect, it } from 'vitest';

import { basename } from 'node:path';

import {
  compile,
  loadMeta,
  readScript,
  runWorkflow,
  stripExport,
  workflowScripts,
} from './harness.js';

/**
 * How to drive each script hard enough to enter every phase it declares.
 *
 * The check below is two-way — declared phases must be entered, not merely entered ones declared — so a script whose
 * phases are gated behind real arguments cannot be exercised by an agent that returns `{}`. Each entry supplies the
 * scenario fixture that answers this script's agents and the arguments that unlock its optional phases.
 *
 * A script with no entry here is driven by the fallback, which is correct for one with no gated phases and wrong for one
 * that has them — so the fallback asserts loudly rather than skipping: an undeclared-phase failure on a new script means
 * it belongs in this table, and that is a better failure than a silent pass.
 */
const DRIVERS = {
  'repo-review': async () => {
    const { reviewScenario } = await import('./repo-review/scenario.js');

    // Every phase this script declares is unconditional once the partition returns a unit, so the default one-finding
    // scenario enters all five; `validators: 1` is the minimum panel that still spawns an adjudicator.
    return { agent: reviewScenario().agent, args: { validators: 1 } };
  },

  'repo-review-fix': async () => {
    const { fixScenario, issue, REVIEWED } = await import('./repo-review-fix/scenario.js');

    // Every phase past Survey is gated on there being a finding to fix *and* a base commit to pin it to, so both have to
    // be supplied: an empty `findings` list returns before spawning even the survey.
    return { agent: fixScenario().agent, args: { findings: [issue()], reviewers: 1, reviewedCommit: REVIEWED } };
  },
};

describe.each(workflowScripts())('$name', ({ path }) => {
  it('parses as an async function body', () => {
    // The tool wraps the file in an async IIFE, which is why its top-level `await` and top-level `return` coexist. A
    // syntax error is otherwise invisible until a run dies, and `node --check` rejects the file for the wrong reason.
    expect(() => compile(stripExport(readScript(path)))).not.toThrow();
  });

  it('has a `meta` block that is a pure literal', () => {
    // The tool reads `meta` before executing the body, so it must contain no variables, calls or interpolation.
    // `loadMeta` evaluates it with nothing in scope, so a reference to a script-local value throws here.
    const { literal, value } = loadMeta(path);

    expect(literal).not.toContain('${');
    expect(value).toEqual(JSON.parse(JSON.stringify(value)));
  });

  it('declares every phase the body actually enters, and no others', async () => {
    // Run the workflow to capture which phases are entered at runtime, not just which phase calls appear in the
    // source. A phase in a never-executed conditional would be found by regex but never entered; a typo or
    // conditional bug in the phase name would pass static analysis but fail here.

    const driver = DRIVERS[basename(path, '.js')];
    const { agent, args } = driver ? await driver() : { agent: async () => ({}), args: {} };

    const { phases } = await runWorkflow({
      scriptPath: path,
      args,
      agent,
    });

    const declared = loadMeta(path).value.phases.map((phase) => phase.title);
    const entered = [...new Set(phases)].sort();

    // Every phase entered at runtime must be declared (strict check for typos and runtime bugs).
    for (const phase of entered) {
      expect(declared, `Phase '${phase}' was entered but not declared in meta.phases`).toContain(phase);
    }

    // Every declared phase should be entered at least once (catches unused declarations and conditional logic bugs).
    expect(entered).toEqual(declared.sort());
  });
});
