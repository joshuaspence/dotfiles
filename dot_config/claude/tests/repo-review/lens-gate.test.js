/**
 * The architecture-lens gate: three whole-repository Opus agents are worth running only when there is repository-level
 * structure to assess, and skipping them has to be recorded as a gap rather than reading as "architecture: clean". So
 * both directions matter — a scope too small must skip and say so, and a scope that only *looks* small must not.
 */

import { describe, expect, it } from 'vitest';

import { runWorkflow } from '../harness.js';
import { HEAD, issue, runReview, SCRIPT } from './scenario.js';

const LENSES = 3;
const SKIPPED = 'Architecture lenses not run';

describe('architecture lens gate', () => {
  it('skips the lenses on a scope of one file, and records the skip', async () => {
    const run = await runReview({
      issues: [issue({ file: 'core/wire.py' })],
      units: [{ name: 'core', summary: 'the protocol', paths: ['core/wire.py'] }],
    });

    expect(run.called(/^review:arch:/)).toEqual([]);
    expect(run.result.gaps.join(' ')).toContain(`${SKIPPED}: only 1 file(s) in scope`);
  });

  it('skips the lenses on a scope of two files, and records the skip', async () => {
    const run = await runReview({
      issues: [issue({ file: 'core/wire.py' })],
      units: [{ name: 'core', summary: 'the protocol', paths: ['core/wire.py', 'core/frame.py'] }],
    });

    expect(run.called(/^review:arch:/)).toEqual([]);
    expect(run.result.gaps.join(' ')).toContain(`${SKIPPED}: only 2 file(s) in scope`);
  });

  it('runs the lenses when the partitioner returns a directory per unit', async () => {
    // The regression: a unit's `paths` are not required to be files, so two directory strings covering a whole
    // repository counted as two files and the structural review was skipped as "too small" — on thousands of files.
    const run = await runReview({
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
    const run = await runReview({
      issues: [issue({ file: 'core/wire.py' })],
      units: [{ name: 'core', summary: 'the protocol', paths: ['core/wire.py', 'lib'] }],
    });

    expect(run.called(/^review:arch:/)).toHaveLength(LENSES);
    expect(run.result.gaps.join(' ')).not.toContain(SKIPPED);
  });

  it('runs the lenses when a unit names no paths at all', async () => {
    // No paths means a file count of 0, which reads as unknown scope rather than as the smallest one there is.
    const run = await runReview({
      issues: [issue({ file: 'core/wire.py' })],
      units: [{ name: 'core', summary: 'the protocol', paths: [] }],
    });

    expect(run.called(/^review:arch:/)).toHaveLength(LENSES);
    expect(run.result.gaps.join(' ')).not.toContain(SKIPPED);
  });

  it('runs the lenses on a wide scope of plain files', async () => {
    const run = await runReview({
      issues: [issue({ file: 'core/wire.py' })],
      units: [{ name: 'core', summary: 'the protocol', paths: ['core/wire.py', 'core/frame.py', 'core/codec.py'] }],
    });

    expect(run.called(/^review:arch:/)).toHaveLength(LENSES);
    expect(run.result.gaps.join(' ')).not.toContain(SKIPPED);
  });

  it('aborts before the lens gate when the partition agent returns an empty units array', async () => {
    // Partition validation catches empty arrays upstream of the lens gate — the gate itself only runs when units have
    // already been validated. This test verifies the empty array error path is handled correctly.
    const run = await runReview({
      issues: [issue({ file: 'core/wire.py' })],
      units: [],
    });

    expect(run.called(/^review:arch:/)).toEqual([]);
    expect(run.result.gaps.join(' ')).toContain('Partition agent did not return usable units');
  });

  it('aborts before the lens gate when the partition agent returns null units', async () => {
    // The partition validation also catches null units. A minimal custom agent is needed since the fixture's default
    // handling falls back to a valid roster when units is null.
    const run = await runWorkflow({
      scriptPath: SCRIPT,
      args: { validators: 1, reviewers: 1 },
      agent: (call) => {
        if (call.label === 'survey') {
          return {
            languages: ['Python'],
            tooling: 'pytest',
            entryPoints: ['core/wire.py'],
            structure: [{ path: 'core', fileCount: 1 }],
            inScopeFileCount: 1,
            headSha: HEAD,
          };
        }
        if (call.label === 'claude-md-scan') {
          return { paths: ['CLAUDE.md'] };
        }
        if (call.label === 'partition') {
          return { units: null, exclusions: [] };
        }
        return null;
      },
    });

    expect(run.called(/^review:arch:/)).toEqual([]);
    expect(run.result.gaps.join(' ')).toContain('Partition agent did not return usable units');
  });

  it('aborts before the lens gate when the partition agent omits the units key', async () => {
    // The partition validation also catches when units is undefined (omitted from the return object). Like the null case,
    // this requires a custom agent to bypass the fixture's default roster.
    const run = await runWorkflow({
      scriptPath: SCRIPT,
      args: { validators: 1, reviewers: 1 },
      agent: (call) => {
        if (call.label === 'survey') {
          return {
            languages: ['Python'],
            tooling: 'pytest',
            entryPoints: ['core/wire.py'],
            structure: [{ path: 'core', fileCount: 1 }],
            inScopeFileCount: 1,
            headSha: HEAD,
          };
        }
        if (call.label === 'claude-md-scan') {
          return { paths: ['CLAUDE.md'] };
        }
        if (call.label === 'partition') {
          return { exclusions: [] };
        }
        return null;
      },
    });

    expect(run.called(/^review:arch:/)).toEqual([]);
    expect(run.result.gaps.join(' ')).toContain('Partition agent did not return usable units');
  });
});
