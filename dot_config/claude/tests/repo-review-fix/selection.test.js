/**
 * Which findings a fix run actually attempts, and what it says about the ones it did not.
 *
 * This is the command's cost control. A ledger accumulates across rounds, so the list handed in has no natural bound —
 * it is every finding the review ever validated and nothing has since fixed. Each entry admitted costs a fixer plus its
 * reviewers, on Opus for the high-risk categories, so an unbounded list is exactly the runaway the split was meant to
 * end. Two knobs bound it: a severity floor filters, then a count cap truncates worst-first.
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

describe('the count cap', () => {
  it('defaults to five, which is what the flagless invocation costs', async () => {
    const { DEFAULT_MAX_FIXES, maxFixes } = await internals({});

    expect(maxFixes).toBe(DEFAULT_MAX_FIXES);
    expect(DEFAULT_MAX_FIXES).toBe(5);
  });

  it('fixes the cap and no more when the ledger holds more than that', async () => {
    const findings = Array.from({ length: 9 }, (_, idx) => bySeverity('high', { file: `src/${idx}.ts` }));
    const run = await runFix({ args: { findings } });

    expect(run.result.considered).toBe(9);
    expect(run.result.selected).toBe(5);
    expect(run.calls.filter((call) => call.label.startsWith('fix:'))).toHaveLength(5);
  });

  it('records the shortfall as a gap, so the caller knows the ledger is not empty', async () => {
    // Without this the caller cannot tell "nothing left to fix" from "hit the cap": both return with every attempted fix
    // applied, so a wrapper reporting the run would say the ledger is clear while 2 defects remain in it.
    const findings = Array.from({ length: 7 }, (_, idx) => bySeverity('high', { file: `src/${idx}.ts` }));
    const run = await runFix({ args: { findings } });

    expect(shortfall(run)).toHaveLength(1);
    expect(shortfall(run)[0]).toMatch(/2 of 7 finding\(s\)/);
    expect(shortfall(run)[0]).toMatch(/2 beyond `--max-fixes 5`/);
  });

  it('says nothing about a shortfall when the whole ledger fits', async () => {
    const run = await runFix({ args: { findings: [bySeverity('high'), bySeverity('low')] } });

    expect(shortfall(run)).toEqual([]);
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
    // `--max-fixes 0` is how the wrapper asks "what would you fix?" without paying for any of it, so it must be a
    // distinct thing from the default rather than a falsy value that falls back to five.
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
