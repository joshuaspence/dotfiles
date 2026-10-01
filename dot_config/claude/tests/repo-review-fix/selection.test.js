/**
 * Which findings a fix run actually attempts, and what it says about the ones it did not.
 *
 * This is the command's cost control. A ledger accumulates across rounds, so the list handed in has no natural bound —
 * it is every finding the review ever validated and nothing has since fixed. Each entry admitted costs a fixer plus its
 * reviewers, on Opus for the high-risk categories, so an unbounded list is exactly the runaway the split was meant to
 * end. Two knobs bound it: a severity floor filters, then a count cap truncates worst-first. Neither has a cost-control
 * default any more — the command asks the user instead — so a run given neither is refused rather than run unbounded.
 *
 * The failure mode being guarded is quiet: truncating in the wrong order still fixes `--max-fixes` findings and still
 * reports a plausible result, it just spends the budget on the least important ones. So the assertions read the
 * *identities* of the findings that got fixers, not the count.
 */

import { describe, expect, it } from 'vitest';

import { internals, issue, promptIssue, runFix } from './scenario.js';

// Severity is the only field selection reads, so fixtures vary it and carry a description naming what they are — which
// is also what makes an ordering failure legible in the assertion diff.
const bySeverity = (severity, over = {}) => issue({ severity, description: `a ${severity} finding`, ...over });

// Which findings got a fixer, in the order the fixers were spawned. Read out of the prompts rather than off the labels,
// because a label names a category and an index and so cannot tell two same-category findings apart — which is exactly
// what an ordering bug produces.
const fixedDescriptions = (run) =>
  run.calls
    .filter((call) => call.label.startsWith('fix:'))
    .map((call) => promptIssue(call.prompt).description);

// The gap the caps raise, as distinct from the teardown and pipeline gaps that share the list.
const shortfall = (run) => run.result.gaps.filter((gap) => /were \*\*not\*\* attempted/.test(gap));

const manyHigh = (count) => Array.from({ length: count }, (_, idx) => bySeverity('high', { file: `src/${idx}.ts` }));

describe('the count cap', () => {
  it('has no default, so an omitted cap caps nothing', async () => {
    // The previous default was 5, and it was the wrong place for the decision: a caller who did not ask for a cap got
    // one anyway, and the 26 findings a 31-finding ledger held back were a number nobody chose. The choice moved to the
    // command, which asks; absent an answer the script applies no ceiling of its own.
    const { maxFixes } = await internals({});

    expect(maxFixes).toBe(Infinity);
  });

  it('attempts every eligible finding when no cap was given', async () => {
    const run = await runFix({ args: { findings: manyHigh(9) } });

    expect(run.result.considered).toBe(9);
    expect(run.result.selected).toBe(9);
    expect(run.calls.filter((call) => call.label.startsWith('fix:'))).toHaveLength(9);
  });

  it('fixes the cap and no more when one was given', async () => {
    const run = await runFix({ args: { findings: manyHigh(9), maxFixes: 4 } });

    expect(run.result.considered).toBe(9);
    expect(run.result.selected).toBe(4);
    expect(run.calls.filter((call) => call.label.startsWith('fix:'))).toHaveLength(4);
  });

  it('records the shortfall as a gap, so the caller knows the ledger is not empty', async () => {
    // Without this the caller cannot tell "nothing left to fix" from "hit the cap": both return with every attempted fix
    // applied, so a wrapper reporting the run would say the ledger is clear while 2 defects remain in it.
    const run = await runFix({ args: { findings: manyHigh(7), maxFixes: 5 } });

    expect(shortfall(run)).toHaveLength(1);
    expect(shortfall(run)[0]).toMatch(/2 of 7 finding\(s\)/);
    expect(shortfall(run)[0]).toMatch(/2 beyond `--max-fixes 5`/);
  });

  it('says nothing about a shortfall when the whole ledger fits', async () => {
    const run = await runFix({ args: { findings: [bySeverity('high'), bySeverity('low')] } });

    expect(shortfall(run)).toEqual([]);
  });

  it('never names a cap it does not have when it explains selecting nothing', async () => {
    // `Infinity` reaching a user-facing string would read as a cap of infinity *having* excluded something, which is the
    // opposite of what happened: an uncapped run that selects nothing was held back entirely by the floor.
    const run = await runFix({ args: { findings: [bySeverity('low')], severity: 'critical' } });

    expect(run.result.gaps.join('\n')).toMatch(/below `critical` severity|at or above `critical`/);
    expect(run.result.gaps.join('\n')).not.toMatch(/Infinity/);
  });
});

describe('what counts as a bounded run', () => {
  // The script's own guard on the command's prompt. `--severity` bounds a run by what is worth fixing and `--max-fixes`
  // by how much; given neither, the run would be one Opus fixer plus reviewers for every finding the ledger has ever
  // accumulated. The command is required to ask the user which they want, and this is what holds it to that — a wrapper
  // that forgets fails here, cheaply, instead of spending the whole ledger.
  //
  // The fixture pins a floor so that every other suite is testing a run the command could really have launched, so a
  // test about the bound itself has to take that floor back off.
  const asTyped = (args = {}) => runFix({ args: { severity: undefined, ...args } });

  it('refuses a run with neither, before any agent is spawned', async () => {
    const run = await asTyped({ findings: manyHigh(9) });

    expect(run.calls).toEqual([]);
    expect(run.result).toMatchObject({ base: null, considered: 9, selected: 0, outcomes: [], sandboxBranches: [] });
  });

  it('names both flags when it refuses, since the refusal is a cue to choose one', async () => {
    const run = await asTyped({ findings: manyHigh(9) });

    expect(run.result.gaps).toHaveLength(1);
    expect(run.result.gaps[0]).toMatch(/no ceiling/);
    expect(run.result.gaps[0]).toMatch(/`--severity <floor>`/);
    expect(run.result.gaps[0]).toMatch(/`--max-fixes <n>`/);
  });

  it('accepts a floor alone, and then fixes everything above it', async () => {
    const run = await asTyped({ findings: manyHigh(3), severity: 'high' });

    expect(run.result.selected).toBe(3);
  });

  it('accepts a cap alone', async () => {
    const run = await asTyped({ findings: manyHigh(3), maxFixes: 2 });

    expect(run.result.selected).toBe(2);
  });

  it('accepts a cap of zero, which is a choice like any other', async () => {
    // `--max-fixes 0` asks what a run would attempt without paying for it, so it has to read as bounded rather than as
    // the absent cap it numerically resembles — and the refusal it gets must be the empty selection, not the unbounded
    // one, because only the first reports how many findings were waiting.
    const run = await asTyped({ findings: manyHigh(3), maxFixes: 0 });

    expect(run.result.selected).toBe(0);
    expect(run.result.gaps.join('\n')).toMatch(/3 finding\(s\)/);
  });
});

describe('worst-first ordering', () => {
  it('spends the cap on the most severe findings in the ledger', async () => {
    const findings = [bySeverity('low'), bySeverity('critical'), bySeverity('medium'), bySeverity('high')];
    const run = await runFix({ args: { findings, maxFixes: 2 } });

    expect(fixedDescriptions(run)).toEqual(['a critical finding', 'a high finding']);
  });

  it('keeps ledger order within a severity, so a repeated run attempts the same findings', async () => {
    // The sort has to be stable for the cap to be idempotent: if two equally severe findings can swap, consecutive runs
    // over an unchanged ledger fix different halves of it and neither ever finishes.
    const findings = ['a', 'b', 'c', 'd'].map((name) => bySeverity('high', { description: name, file: `src/${name}.ts` }));
    const run = await runFix({ args: { findings, maxFixes: 2 } });

    expect(fixedDescriptions(run)).toEqual(['a', 'b']);
  });

  it('treats a severity it does not recognise as the lowest, rather than the highest', async () => {
    // A ledger is a file a human can edit, so an unknown severity is reachable. Ranking it unknown-as-worst would let a
    // typo outrank a real critical; ranking it unknown-as-least only delays it.
    const { severityRank, SEVERITY_ORDER } = await internals({});

    expect(severityRank({ severity: 'catastrophic' })).toBe(severityRank({ severity: SEVERITY_ORDER[0] }));
    expect(severityRank({})).toBe(severityRank({ severity: SEVERITY_ORDER[0] }));

    const findings = [bySeverity('catastrophic'), bySeverity('medium')];
    const run = await runFix({ args: { findings, maxFixes: 1 } });

    expect(fixedDescriptions(run)).toEqual(['a medium finding']);
  });
});

describe('the severity floor', () => {
  it('drops everything below it before the cap is applied', async () => {
    // Order matters here: filtering after truncating would let a run's worth of `low` findings crowd out the one `high`
    // the floor was raised to reach.
    const findings = [
      bySeverity('low', { file: 'src/1.ts' }),
      bySeverity('medium', { file: 'src/2.ts' }),
      bySeverity('high', { file: 'src/3.ts' }),
    ];
    const run = await runFix({ args: { findings, severity: 'high', maxFixes: 1 } });

    expect(run.result.considered).toBe(3);
    expect(fixedDescriptions(run)).toEqual(['a high finding']);

    // Attributed to the floor, not to the cap — the two knobs are separately adjustable and a user told the wrong one is
    // holding their findings back will turn the wrong dial.
    expect(shortfall(run)[0]).toMatch(/2 below `high` severity/);
  });

  it('admits the floor itself, not only what is above it', async () => {
    const run = await runFix({ args: { findings: [bySeverity('medium')], severity: 'medium' } });

    expect(fixedDescriptions(run)).toEqual(['a medium finding']);
  });
});

describe('runs that spawn nothing', () => {
  // The cheapest thing this command can do is refuse to start, and both paths below have to reach that without paying
  // for the survey — which is a real agent on a real repo, and pointless when there is nothing to base on it.

  it('spawns no agent at all when the ledger is empty', async () => {
    const run = await runFix({ args: { findings: [] } });

    expect(run.calls).toEqual([]);
    expect(run.result).toMatchObject({ base: null, considered: 0, selected: 0, outcomes: [], sandboxBranches: [] });
  });

  it('spawns no agent when the floor excludes every finding', async () => {
    const run = await runFix({ args: { findings: [bySeverity('low')], severity: 'critical' } });

    expect(run.calls).toEqual([]);
    expect(run.result).toMatchObject({ considered: 1, selected: 0, outcomes: [] });
  });

  it('spawns no agent when the cap is zero', async () => {
    // `--max-fixes 0` is how the wrapper asks "what would you fix?" without paying for any of it, so it must survive
    // the non-negative parse rather than reading as a falsy value with no cap behind it.
    const run = await runFix({ args: { findings: [bySeverity('critical')], maxFixes: 0 } });

    expect(run.calls).toEqual([]);
    expect(run.result).toMatchObject({ considered: 1, selected: 0, outcomes: [] });
  });

  it('still reports what it was holding, so an empty run is not mistaken for an empty ledger', async () => {
    const run = await runFix({ args: { findings: [bySeverity('low'), bySeverity('low')], maxFixes: 0 } });

    expect(run.result.considered).toBe(2);
    expect(run.result.gaps.join('\n')).toMatch(/No fix was attempted.*2 finding\(s\)/s);
  });

  it('raises no gap for an empty ledger, which is the one honest way to finish with nothing', async () => {
    // The distinction the gap list exists to draw: 2 findings held back is a shortfall the user should see, whereas 0
    // findings to fix is a clean run, and a gap there would make every no-op invocation report as incomplete.
    const run = await runFix({ args: { findings: [] } });

    expect(run.result.gaps).toEqual([]);
  });
});
