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

    // Build an agent mock and args appropriate for this workflow.
    let agent, args;
    const workflowName = basename(path, '.js');

    if (workflowName === 'repo-review') {
      // Import the scenario builder for repo-review to get a working agent mock.
      const { fixScenario } = await import('./repo-review/scenario.js');
      ({ agent } = fixScenario());
      // Enable fix mode and set minimal counts to exercise all phases.
      args = { fix: true, validators: 1, reviewers: 1 };
    } else {
      // For other workflows, use a minimal agent that returns empty objects.
      agent = async () => ({});
      args = {};
    }

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
