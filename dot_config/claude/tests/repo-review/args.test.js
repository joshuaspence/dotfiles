/**
 * Argument handling. Each knob has to tolerate a missing or malformed value without silently reviewing something other
 * than what was asked for — a default that quietly widens the scope or turns `--fix` off is worse than an error.
 */

import { describe, expect, it } from 'vitest';

import { runWorkflow } from '../harness.js';
import { fixScenario, internals, runFix, SCRIPT } from './scenario.js';

describe('args arriving as a JSON string', () => {
  it('is recovered, so the knobs inside it still take effect', async () => {
    // This call site has delivered `args` JSON-encoded rather than as an object. Falling back to defaults would look
    // like a successful run while reviewing the whole repository with `--fix` off.
    const scenario = fixScenario();
    const run = await runWorkflow({
      scriptPath: SCRIPT,
      args: JSON.stringify({ fix: true, validators: 1, reviewers: 1, path: 'src' }),
      agent: scenario.agent,
    });

    expect(run.result.fix).toBeDefined();
    expect(run.logs[0]).toContain('fix: on');
    expect(run.logs[0]).toContain('scope: src');
  });

  it('aborts before the first agent when it is not JSON at all', async () => {
    const run = await runWorkflow({ scriptPath: SCRIPT, args: 'src --fix', agent: () => null });

    expect(run.calls).toHaveLength(0);
    expect(run.result.findings).toEqual([]);
    expect(run.result.gaps.join(' ')).toContain('nothing was reviewed');
  });
});

describe('knobs', () => {
  it('clamps an unknown effort to the default', async () => {
    expect((await internals({ effort: 'turbo' })).effort).toBe('high');
    expect((await internals({ effort: 'low' })).effort).toBe('low');
  });

  it('caps the high-fan-out agents at xhigh but leaves lower efforts alone', async () => {
    // Many concurrent `max` Opus inferences have been observed to stall, and the Review phase is a barrier, so one hung
    // leaf agent wedges the run.
    expect((await internals({ effort: 'max' })).leafEffort).toBe('xhigh');
    expect((await internals({ effort: 'medium' })).leafEffort).toBe('medium');
  });

  it('accepts zero reviewers without falling back to one', async () => {
    // `--reviewers 0` disables the Review Fix phase, so it needs a non-negative parser rather than a positive one.
    expect((await internals({ reviewers: 0 })).reviewers).toBe(0);
    expect((await internals({ reviewers: 'many' })).reviewers).toBe(1);
    expect((await internals({})).reviewers).toBe(1);
  });

  it('treats a bare --loop as the default round cap and no --loop as a single pass', async () => {
    expect((await internals({ loop: true })).maxRounds).toBe(4);
    expect((await internals({ loop: 7 })).maxRounds).toBe(7);
    expect((await internals({})).maxRounds).toBe(1);
  });

  it('sizes the auto partition range to the code in scope', async () => {
    // Told to find 4-8 units in a single file, the partitioner invents conceptual slices — and the Review phase is
    // units x reviewers, so every invented slice costs six more agents re-reading the same file.
    const { autoUnitTarget } = await internals();

    expect(autoUnitTarget(1)).toBe('exactly 1 unit');
    expect(autoUnitTarget(4)).toBe('the range 1-2');
    expect(autoUnitTarget(200)).toBe('the range 4-8');

    // 0 means the survey returned no usable count: unknown scope keeps the repository-sized default.
    expect(autoUnitTarget(0)).toBe('the range 4-8');
  });
});

describe('path scope', () => {
  it('scopes the review to several subtrees at once', async () => {
    const { paths, scope, lsFiles } = await internals({ paths: ['src', 'lib'] });

    expect(paths).toEqual(['src', 'lib']);
    expect(scope).toBe('the subtrees `src`, `lib`');
    expect(lsFiles).toBe("git ls-files -- 'src' 'lib'");
  });

  it('accepts a lone string and the singular key, so a scope is never dropped on a shape mismatch', async () => {
    // A dropped scope does not fail: it reviews the whole repository while every later phase behaves correctly for
    // that wider scope, so nothing downstream can detect it.
    expect((await internals({ paths: 'src' })).scope).toBe('the subtree `src`');
    expect((await internals({ path: 'src' })).scope).toBe('the subtree `src`');
    expect((await internals({ path: ['src', 'lib'] })).paths).toEqual(['src', 'lib']);
  });

  it('drops blank entries and collapses duplicates', async () => {
    // A duplicate costs nothing in the pathspec but reaches the agents as prose implying two distinct scopes.
    expect((await internals({ paths: ['src', ' ', 'src', ' lib ', null] })).paths).toEqual(['src', 'lib']);
  });

  it('reviews the whole repository when no path is given', async () => {
    const { paths, scope, lsFiles } = await internals({});

    expect(paths).toEqual([]);
    expect(scope).toBe('the whole repository');
    expect(lsFiles).toBe('git ls-files');
  });

  it('names every subtree to the architecture lenses, which still read the whole repository', async () => {
    const { architecturalLensPrompt, ARCHITECTURAL_LENSES } = await internals({ paths: ['src', 'lib'] });
    const prompt = architecturalLensPrompt(ARCHITECTURAL_LENSES[0], { languages: ['TypeScript'] }, []);

    expect(prompt).toContain('A path scope is in effect (`src`, `lib`)');
    expect(prompt).toContain('report only defects that involve those subtrees');
  });

  it('logs the scope it is running with', async () => {
    const run = await runFix({ args: { paths: ['src', 'lib'] } });

    expect(run.logs[0]).toContain('scope: src, lib');
  });
});

describe('without --fix', () => {
  it('returns a read-only result and runs no fix agents', async () => {
    const run = await runFix({ args: { fix: false } });

    expect(run.result.fix).toBeUndefined();
    expect(run.result.findings).toHaveLength(1);
    expect(run.called(/^fix:/)).toHaveLength(0);
    expect(run.phases).not.toContain('Reconcile');
  });
});
