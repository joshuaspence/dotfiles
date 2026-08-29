/**
 * The architecture-lens gate: three whole-repository Opus agents are worth running only when there is repository-level
 * structure to assess, and skipping them has to be recorded as a gap rather than reading as "architecture: clean". So
 * both directions matter — a scope too small must skip and say so, and a scope that only *looks* small must not.
 */

import { describe, expect, it } from 'vitest';

import { issue, runFix } from './scenario.js';

const LENSES = 3;
const SKIPPED = 'Architecture lenses not run';

describe('architecture lens gate', () => {
  it('skips the lenses on a scope of two files, and records the skip', async () => {
    const run = await runFix({
      args: { fix: false },
      issues: [issue({ file: 'core/wire.py' })],
      units: [{ name: 'core', summary: 'the protocol', paths: ['core/wire.py', 'core/frame.py'] }],
    });

    expect(run.called(/^review:arch:/)).toEqual([]);
    expect(run.result.gaps.join(' ')).toContain(`${SKIPPED}: only 2 file(s) in scope`);
  });

  it('runs the lenses when the partitioner returns a directory per unit', async () => {
    // The regression: a unit's `paths` are not required to be files, so two directory strings covering a whole
    // repository counted as two files and the structural review was skipped as "too small" — on thousands of files.
    const run = await runFix({
      args: { fix: false },
      issues: [issue({ file: 'core/wire.py' })],
      units: [
        { name: 'core', summary: 'the protocol', paths: ['core'] },
        { name: 'api', summary: 'the request surface', paths: ['api/'] },
      ],
    });

    expect(run.called(/^review:arch:/)).toHaveLength(LENSES);
    expect(run.result.gaps.join(' ')).not.toContain(SKIPPED);
  });

  it('runs the lenses once one unit covers a directory, however many files the others name', async () => {
    // One unknown-sized path makes the whole scope unknown-sized: the two files beside it are a floor, not a count.
    const run = await runFix({
      args: { fix: false },
      issues: [issue({ file: 'core/wire.py' })],
      units: [{ name: 'core', summary: 'the protocol', paths: ['core/wire.py', 'lib'] }],
    });

    expect(run.called(/^review:arch:/)).toHaveLength(LENSES);
    expect(run.result.gaps.join(' ')).not.toContain(SKIPPED);
  });

  it('runs the lenses on a wide scope of plain files', async () => {
    const run = await runFix({
      args: { fix: false },
      issues: [issue({ file: 'core/wire.py' })],
      units: [{ name: 'core', summary: 'the protocol', paths: ['core/wire.py', 'core/frame.py', 'core/codec.py'] }],
    });

    expect(run.called(/^review:arch:/)).toHaveLength(LENSES);
    expect(run.result.gaps.join(' ')).not.toContain(SKIPPED);
  });
});
