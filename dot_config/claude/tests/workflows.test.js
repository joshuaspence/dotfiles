/**
 * Invariants every workflow script must satisfy to be loadable by the `Workflow` tool at all.
 *
 * These are the properties whose violation makes a script fail at launch, where the only feedback is a dead run — so
 * they are checked for every script in the source directory, including ones added after this file was written.
 */

import { describe, expect, it } from 'vitest';

import { compile, loadMeta, readScript, stripExport, workflowScripts } from './harness.js';

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

  it('declares every phase the body actually enters, and no others', () => {
    const source = readScript(path);

    // A phase group is created either by a `phase('X')` call or by an agent's `phase: 'X'` option — `/repo-review`'s
    // 'Review Fix' only ever arrives the second way. Titles are matched exactly, so a title used but not declared gets
    // an unnamed box, and one declared but never used gets an empty one.
    const used = new Set([
      ...[...source.matchAll(/\bphase\('([^']+)'\)/g)].map(([, title]) => title),
      ...[...source.matchAll(/\bphase: '([^']+)'/g)].map(([, title]) => title),
    ]);

    const declared = loadMeta(path).value.phases.map((phase) => phase.title);

    expect([...used].sort()).toEqual([...declared].sort());
  });
});
