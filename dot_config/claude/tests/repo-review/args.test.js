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

describe('without --fix', () => {
  it('returns a read-only result and runs no fix agents', async () => {
    const run = await runFix({ args: { fix: false } });

    expect(run.result.fix).toBeUndefined();
    expect(run.result.findings).toHaveLength(1);
    expect(run.called(/^fix:/)).toHaveLength(0);
    expect(run.phases).not.toContain('Reconcile');
  });
});
