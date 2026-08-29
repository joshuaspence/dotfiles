/**
 * Cascading phase failures: what happens when multiple phases fail in sequence.
 *
 * The script handles each phase failure independently (survey → abort, partition → abort, reviewer → gap, dedupe → gap,
 * validator → gap), but these tests examine what happens when multiple failures occur in sequence, or when a gap in one
 * phase affects the inputs to the next. This ensures that gaps accumulate correctly and error messages remain clear even
 * when the review hits multiple infrastructure problems.
 */

import { describe, expect, it } from 'vitest';

import { issue, outcomeAt, runFix } from './scenario.js';

describe('dedupe phase failures', () => {
  it('records a gap when dedupe fails but continues to validation', async () => {
    // Dedupe fails to return, but the pipeline continues to validation with raw findings.
    // Need at least 2 findings for dedupe to run (single findings are trivially not duplicates).
    const run = await runFix({
      issues: [
        issue({ file: 'src/a.ts', description: 'first' }),
        issue({ file: 'src/b.ts', description: 'second' }),
      ],
      dedupe: () => null,
    });

    // Dedupe gap should be recorded with specific message about unit scope failure.
    expect(run.result.gaps.some((gap) => gap.includes('Dedupe did not return for 1 of 1 scope(s)'))).toBe(true);
    expect(run.result.gaps.some((gap) => gap.includes('kept raw'))).toBe(true);

    // Findings should still validate and potentially fix (dedupe failure doesn't block downstream phases).
    expect(run.result.findings).toHaveLength(2);
    expect(run.result.fix.commits).toHaveLength(2);
  });
});

describe('dedupe failures cascading into validation', () => {
  it('passes raw findings to validation when dedupe fails, accumulating both gaps', async () => {
    // Dedupe fails to return for a unit, so findings stay raw. Validation then also fails.
    const run = await runFix({
      issues: [
        issue({ file: 'src/a.ts', description: 'first potential duplicate', category: 'bug' }),
        issue({ file: 'src/b.ts', description: 'second potential duplicate', category: 'bug' }),
      ],
      args: { validators: 1, reviewers: 1 },
      dedupe: () => null,
      validate: () => null,
    });

    // Both gaps should be recorded.
    expect(run.result.gaps.some((gap) => gap.includes('Dedupe did not return for 1 of 1 scope(s)'))).toBe(true);
    expect(run.result.gaps.some((gap) => gap.includes('Validation did not complete'))).toBe(true);

    // The findings should be dropped (validation failed).
    expect(run.result.findings).toEqual([]);
  });

  it('keeps findings raw when dedupe fails but validation succeeds', async () => {
    // Dedupe fails, but validation confirms the findings. They should be kept, and the dedupe gap recorded.
    const run = await runFix({
      issues: [
        issue({ file: 'src/a.ts', description: 'first', category: 'bug' }),
        issue({ file: 'src/b.ts', description: 'second', category: 'bug' }),
      ],
      args: { validators: 1, reviewers: 1 },
      dedupe: () => null,
    });

    expect(run.result.gaps.some((gap) => gap.includes('Dedupe did not return for 1 of 1 scope(s)'))).toBe(true);
    expect(run.result.gaps.some((gap) => gap.includes('kept raw'))).toBe(true);

    // Both findings validated and kept (dedupe failure doesn't block validation).
    expect(run.result.findings).toHaveLength(2);
  });
});

describe('validation failures cascading into fix', () => {
  it('records validation gap but has nothing to fix', async () => {
    // All validators fail, so no findings pass to the fix phase.
    const run = await runFix({
      issues: [issue()],
      validate: () => null,
    });

    expect(run.result.gaps.some((gap) => gap.includes('Validation did not complete'))).toBe(true);
    expect(run.result.findings).toEqual([]);
    expect(run.result.fix).toBeUndefined();
  });

  it('fixes only the findings that passed validation when some validators fail', async () => {
    // Two findings: first validator succeeds, second fails.
    const run = await runFix({
      issues: [
        issue({ file: 'src/a.ts', description: 'first', category: 'bug' }),
        issue({ file: 'src/b.ts', description: 'second', category: 'security' }),
      ],
      validate: (subject) => {
        if (subject.file === 'src/a.ts') {
          return { confirmed: true, rationale: 'confirmed' };
        }
        return null;
      },
    });

    expect(run.result.gaps.some((gap) => gap.includes('Validation did not complete'))).toBe(true);
    expect(run.result.findings).toHaveLength(1);
    expect(run.result.findings[0].file).toBe('src/a.ts');
    expect(run.result.fix.commits).toHaveLength(1);
  });
});

describe('fix failures after multiple upstream gaps', () => {
  it('records fix gap on top of dedupe and validation gaps', async () => {
    // Dedupe fails, validation fails for one finding but succeeds for another, then fix fails.
    const run = await runFix({
      issues: [
        issue({ file: 'src/a.ts', description: 'first', category: 'bug' }),
        issue({ file: 'src/b.ts', description: 'second', category: 'bug' }),
      ],
      dedupe: () => null,
      validate: (subject) => {
        // Only first finding validates.
        if (subject.file === 'src/a.ts') {
          return { confirmed: true, rationale: 'confirmed' };
        }
        return null;
      },
      fix: () => null,
    });

    // All three gap types should be present.
    expect(run.result.gaps.some((gap) => gap.includes('Dedupe did not return for 1 of 1 scope(s)'))).toBe(true);
    expect(run.result.gaps.some((gap) => gap.includes('Validation did not complete'))).toBe(true);
    expect(run.result.gaps.some((gap) => gap.includes('Fix agent did not return'))).toBe(true);

    // One finding validated but fix failed.
    expect(run.result.findings).toHaveLength(1);
    expect(outcomeAt(run, 0).status).toBe('verify-failed');
  });

  it('accumulates gaps across review, dedupe, validation, and fix phases', async () => {
    // Comprehensive cascading failure: partial reviewer failure, dedupe failure, partial validation failure, and fix failure.
    const run = await runFix({
      issues: [
        issue({ file: 'src/a.ts', description: 'issue one', category: 'bug' }),
        issue({ file: 'src/b.ts', description: 'issue two', category: 'code-quality' }),
      ],
      dedupe: () => null,
      validate: (subject, { idx }) => {
        // First validates, second doesn't.
        return idx === 0 ? { confirmed: true, rationale: 'confirmed' } : null;
      },
      fix: (subject, { idx }) => {
        // Fix fails for the one that validated.
        return idx === 0 ? null : { status: 'declined', branch: 'rrfix/wf_test/0', reason: 'not safe' };
      },
    });

    // Multiple gap types accumulated.
    expect(run.result.gaps.length).toBeGreaterThan(1);
    expect(run.result.gaps.some((gap) => gap.includes('Dedupe did not return for 1 of 1 scope(s)'))).toBe(true);
    expect(run.result.gaps.some((gap) => gap.includes('Validation did not complete'))).toBe(true);
    expect(run.result.gaps.some((gap) => gap.includes('Fix agent did not return'))).toBe(true);

    // Only the first finding validated.
    expect(run.result.findings).toHaveLength(1);

    // But its fix failed.
    expect(outcomeAt(run, 0).status).toBe('verify-failed');
  });
});

describe('fix review failures after upstream gaps', () => {
  it('records review gap on top of dedupe and validation gaps', async () => {
    // Dedupe gap, then validation gap, then fix succeeds but review fails.
    const run = await runFix({
      issues: [
        issue({ file: 'src/a.ts', description: 'first', category: 'bug' }),
        issue({ file: 'src/b.ts', description: 'second', category: 'bug' }),
      ],
      dedupe: () => null,
      validate: (_, { idx }) => idx === 0 ? { confirmed: true, rationale: 'confirmed' } : null,
      reviewFix: () => null,
    });

    expect(run.result.gaps.some((gap) => gap.includes('Dedupe did not return for 1 of 1 scope(s)'))).toBe(true);
    expect(run.result.gaps.some((gap) => gap.includes('Fix review did not complete'))).toBe(true);

    // Only first finding validated but fix review failed.
    expect(run.result.findings).toHaveLength(1);
    expect(outcomeAt(run, 0).status).toBe('review-rejected');
    expect(run.result.fix.commits).toEqual([]);
  });

  it('continues through the full pipeline accumulating all gaps', async () => {
    // Full cascade: dedupe fails, validation partially fails, fix succeeds, review fails.
    const run = await runFix({
      issues: [
        issue({ file: 'src/a.ts', description: 'first', category: 'bug' }),
        issue({ file: 'src/b.ts', description: 'second', category: 'bug' }),
      ],
      dedupe: () => null,
      validate: (subject, { idx }) => {
        // Only first validates.
        return idx === 0 ? { confirmed: true, rationale: 'confirmed' } : null;
      },
      reviewFix: () => null,
    });

    // Gaps from dedupe, validation, and fix review.
    expect(run.result.gaps.some((gap) => gap.includes('Dedupe did not return for 1 of 1 scope(s)'))).toBe(true);
    expect(run.result.gaps.some((gap) => gap.includes('Validation did not complete'))).toBe(true);
    expect(run.result.gaps.some((gap) => gap.includes('Fix review did not complete'))).toBe(true);

    // Only first finding validated.
    expect(run.result.findings).toHaveLength(1);
    expect(outcomeAt(run, 0).status).toBe('review-rejected');
  });
});

describe('cross-unit dedupe failures', () => {
  it('records both per-unit and cross-unit dedupe gaps', async () => {
    // Multiple units, per-unit dedupe partially fails, cross-unit dedupe also fails.
    // Each unit needs multiple findings for per-unit dedupe to run.
    const run = await runFix({
      issues: [
        issue({ file: 'src/core/a.ts', description: 'first', category: 'bug' }),
        issue({ file: 'src/core/b.ts', description: 'second', category: 'bug' }),
        issue({ file: 'src/util/c.ts', description: 'third', category: 'bug' }),
        issue({ file: 'src/util/d.ts', description: 'fourth', category: 'bug' }),
      ],
      units: [
        { name: 'core', summary: 'core logic', paths: ['src/core'] },
        { name: 'util', summary: 'utilities', paths: ['src/util'] },
      ],
      dedupe: (call) => {
        const label = call?.label ?? '';
        // Per-unit dedupe succeeds for 'core', fails for 'util'.
        if (label.includes(':core')) {
          return { groups: [] };
        }
        if (label.includes(':util')) {
          return null;
        }
        // Cross-unit dedupe fails.
        if (label.includes(':cross')) {
          return null;
        }
        return { groups: [] };
      },
    });

    // Both types of dedupe gaps should be recorded.
    expect(run.result.gaps.some((gap) => gap.includes('Dedupe did not return for 1 of 2 scope(s)') && gap.includes('util'))).toBe(true);
    expect(run.result.gaps.some((gap) => gap.includes('cross-unit dedupe pass did not return'))).toBe(true);

    // Findings should still validate and potentially fix.
    expect(run.result.findings.length).toBeGreaterThan(0);
  });
});

describe('early abort phases versus gap-accumulating phases', () => {
  it('partition failure aborts immediately', async () => {
    // Partition fails - should abort before review runs.
    const run = await runFix({
      issues: [issue()],
      units: [],
    });

    // Only partition gap, no downstream gaps.
    expect(run.result.gaps.some((gap) => gap.includes('Partition agent did not return usable units'))).toBe(true);
    expect(run.result.findings).toEqual([]);
  });

  it('post-partition failures accumulate gaps without aborting', async () => {
    // After partition succeeds, failures in dedupe/validate/fix accumulate gaps but don't abort.
    const run = await runFix({
      issues: [
        issue({ file: 'src/a.ts', description: 'first' }),
        issue({ file: 'src/b.ts', description: 'second' }),
      ],
      dedupe: () => null,
      validate: () => null,
    });

    // Multiple gaps, no abort.
    expect(run.result.gaps.length).toBeGreaterThan(1);
    expect(run.result.gaps.some((gap) => gap.includes('Dedupe did not return for 1 of 1 scope(s)'))).toBe(true);
    expect(run.result.gaps.some((gap) => gap.includes('Validation'))).toBe(true);
  });
});
