/**
 * Cascading phase failures: what happens when multiple phases fail in sequence.
 *
 * The script handles each phase failure independently (survey → abort, partition → abort, reviewer → gap, dedupe → gap,
 * validator → gap), but these tests examine what happens when multiple failures occur in sequence, or when a gap in one
 * phase affects the inputs to the next. This ensures that gaps accumulate correctly and error messages remain clear even
 * when the review hits multiple infrastructure problems.
 *
 * A single phase failing on its own is pinned by the suite that owns that phase — dedupe returning nothing by
 * `dedupe.test.js`, validation and fix review by `review-gate.test.js`, a fix agent that never returned by
 * `fix-landing.test.js`, an aborting partition by `args.test.js`. What none of those can show is one run losing
 * something at several phases at once, where every gap has to survive the next phase's failure and stay attributed to
 * the finding it was lost on instead of collapsing into a single "the review failed" line. So a scenario here fails
 * more than one phase, and the assertions below are about the whole gap list rather than the presence of one substring
 * somewhere in it.
 */

import { describe, expect, it } from 'vitest';

import { runWorkflow } from '../harness.js';
import { fixScenario, issue, outcomeAt, runFix, SCRIPT } from './scenario.js';

// --- Gap matchers ----------------------------------------------------------------------------------------------------
// One matcher per gap the script can record, matching the *whole* line. A substring probe for 'Validation did not
// complete' keeps passing once the message stops naming the file, the lines or the cause, and those details are the
// entire point of a gap: it is frequently the only surviving trace of the finding it is about. Every argument is
// optional and narrows the match, so `GAP.validation()` is any validation gap and `GAP.validation('src/b.ts:10')` is
// the one for that finding. Sites and scope names are matched literally, not as patterns, so a caller writes the file
// name it sees in the report.

const literal = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// `[\w-]+` and not `\w+` for the category, so the hyphenated ones — `code-quality`, `test-critique` — match too.
const perFinding = (phrase, site) =>
  new RegExp(`^${phrase} for a [\\w-]+ finding at ${site ? literal(site) : '.+'} — .+$`);

const GAP = {
  lens: () => /^Architecture lenses not run: only \d+ file\(s\) in scope — too small for a structural review\.$/,

  dedupe: ({ stalled = '\\d+', scopes = '\\d+', names } = {}) =>
    new RegExp(
      `^Dedupe did not return for ${stalled} of ${scopes} scope\\(s\\) in round \\d+ ` +
        `\\(${names ? literal(names) : '[^)]+'}\\) — those findings were kept raw, so one defect may be reported ` +
        'more than once\\.$',
    ),

  crossDedupe: () =>
    new RegExp(
      '^\\d+ chunk\\(s\\) of the cross-unit dedupe pass did not return in round \\d+ — duplicates inside a unit ' +
        'were still merged, but one defect reported under two different units may appear twice\\.$',
    ),

  partition: () => /^Partition agent did not return usable units — review aborted\.$/,
  reviewer: (label) => new RegExp(`^Reviewer did not complete: ${label ? literal(label) : '.+'}$`),
  validation: (site) => perFinding('Validation did not complete', site),
  fix: (site) => perFinding('Fix agent did not return', site),
  fixReview: (site) => perFinding('Fix review did not complete', site),

  // The phase-wide notice for a fix pipeline that threw rather than returned, with the underlying error attached.
  fixPipeline: (cause) =>
    new RegExp(
      '^(?:The Fix phase did not run: all \\d+|\\d+ of \\d+) fix pipeline\\(s\\) failed before returning, so those ' +
        `findings were never fixed and are \\*\\*not\\*\\* verified as unfixable\\. Cause: ${literal(cause)}$`,
    ),

  reconcile: () => /^Reconciliation failed for \d+ colliding fix\(es\) on .+ — left unfixed\.(?: Cause: .+)?$/,
};

// --- Gap assertions --------------------------------------------------------------------------------------------------
// Every gap the run recorded, numbered. Attached to each failure because "no gap matched" does not say what the run
// recorded instead, which is the first thing anyone reading the failure wants.
const gapDump = (run) =>
  run.result.gaps.length ? run.result.gaps.map((gap, index) => `  ${index + 1}. ${gap}`).join('\n') : '  (no gaps)';

const gapsMatching = (run, matcher) => run.result.gaps.filter((gap) => matcher.test(gap));

// How many gaps of this shape the run recorded — counted, never merely spotted. `.some()` also passes on a run that
// recorded the gap for the wrong finding, or recorded it twice where one finding was lost, and both of those are the
// bugs this file is about.
function expectGaps(run, matcher, count = 1) {
  expect(gapsMatching(run, matcher), `Expected ${count} gap(s) matching ${matcher}\nActual gaps:\n${gapDump(run)}`)
    .toHaveLength(count);
}

// No gap of this shape at all: the phase either ran cleanly or never ran, and a gap for it would send the reader
// looking for a finding that was never lost.
const expectNoGap = (run, matcher) => expectGaps(run, matcher, 0);

// The total, so that the gaps named individually account for every gap the run recorded and nothing is hiding in the
// remainder.
function expectGapCount(run, count) {
  expect(run.result.gaps, `Actual gaps:\n${gapDump(run)}`).toHaveLength(count);
}

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
    expectGaps(run, GAP.dedupe({ stalled: 1, scopes: 1, names: 'core' }));

    // But validation and both fix phases succeeded, so none of them recorded anything.
    expectNoGap(run, GAP.validation());
    expectNoGap(run, GAP.fix());
    expectNoGap(run, GAP.fixReview());

    // Findings should still validate and potentially fix (dedupe failure doesn't block downstream phases).
    expect(run.result.findings).toHaveLength(2);
    // Both findings validated and were fixed successfully (dedupe failure doesn't prevent fixes).
    expect(run.result.fix.commits).toHaveLength(2);
  });

  it('records a gap when the dedupe agent stalls (throws) but continues to validation', async () => {
    // A stalled agent throws, which is how the real harness surfaces one killed by the no-progress watchdog — a
    // different failure mode from returning null, and the scope has to be reported as unanswered either way.
    const run = await runFix({
      issues: [
        issue({ file: 'src/a.ts', description: 'first' }),
        issue({ file: 'src/b.ts', description: 'second' }),
      ],
      dedupe: () => {
        throw new Error('Agent stalled');
      },
    });

    // Dedupe gap should be recorded (a stall reads the same as a null return in the gap message).
    expectGaps(run, GAP.dedupe({ stalled: 1, scopes: 1, names: 'core' }));

    // Findings should still validate and potentially fix (a stall doesn't block downstream phases either).
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

    // Both gaps should be recorded, and the count says which: the architecture-lens skip this two-file scope always
    // carries, the dedupe gap, and one validation gap per finding. A count rather than a `gaps.length > 1` threshold,
    // because the lens gap alone already satisfied such a threshold — it held even if nothing downstream of partition
    // recorded a gap at all.
    expectGapCount(run, 4);
    expectGaps(run, GAP.lens());
    expectGaps(run, GAP.dedupe({ stalled: 1, scopes: 1, names: 'core' }));
    expectGaps(run, GAP.validation(), 2);

    // The findings should be dropped (validation failed).
    expect(run.result.findings).toEqual([]);
  });

  it('accumulates gaps when dedupe stalls (throws) and validation also fails', async () => {
    // The same cascade, but dedupe stalls instead of returning null: both gaps still have to accumulate.
    const run = await runFix({
      issues: [
        issue({ file: 'src/a.ts', description: 'first potential duplicate', category: 'bug' }),
        issue({ file: 'src/b.ts', description: 'second potential duplicate', category: 'bug' }),
      ],
      args: { validators: 1, reviewers: 1 },
      dedupe: () => {
        throw new Error('Agent stalled');
      },
      validate: () => null,
    });

    // The same four gaps as the null-return case above, in the same composition.
    expectGapCount(run, 4);
    expectGaps(run, GAP.lens());
    expectGaps(run, GAP.dedupe({ stalled: 1, scopes: 1, names: 'core' }));
    expectGaps(run, GAP.validation(), 2);

    // The findings should be dropped (validation failed).
    expect(run.result.findings).toEqual([]);
  });
});

describe('validation failures cascading into fix', () => {
  it('records validation gap but has nothing to fix', async () => {
    // All validators fail, so no findings pass to the fix phase.
    const run = await runFix({
      issues: [issue()],
      validate: () => null,
    });

    expectGaps(run, GAP.validation('src/a.ts:10'));
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

    // The gap names `src/b.ts`, the finding that was actually lost — not just "validation".
    expectGaps(run, GAP.validation('src/b.ts:10'));

    // Dedupe is not configured to fail here, so it must not have recorded anything.
    expectNoGap(run, GAP.dedupe());

    expect(run.result.findings).toHaveLength(1);
    expect(run.result.findings[0].file).toBe('src/a.ts');
    // Only src/a.ts validated successfully, so only 1 commit.
    expect(run.result.fix.commits).toHaveLength(1);
  });
});

describe('fix failures after multiple upstream gaps', () => {
  it('records fix gap on top of dedupe and validation gaps, each naming the finding it lost', async () => {
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

    // All three gap types should be present, and the two per-finding gaps name *different* findings — `src/b.ts` was
    // lost to validation, `src/a.ts` to the fixer — so a reader can tell which finding to distrust for which reason.
    // A later failure neither overwrites an earlier gap nor absorbs it.
    expectGaps(run, GAP.dedupe({ stalled: 1, scopes: 1, names: 'core' }));
    expectGaps(run, GAP.validation('src/b.ts:10'));
    expectGaps(run, GAP.fix('src/a.ts:10'));

    // Only src/a.ts validated (src/b.ts validation failed), so 1 finding — and it still reaches the report, carrying
    // the fixer's failure.
    expect(run.result.findings.map((subject) => subject.file)).toEqual(['src/a.ts']);
    expect(outcomeAt(run, 0).status).toBe('verify-failed');
  });

  it('accumulates gaps across review, dedupe, validation, and fix phases', async () => {
    // Comprehensive cascading failure: partial reviewer failure, dedupe failure, partial validation failure, and fix
    // failure. `runFix` drives `fixScenario`'s agent as-is and so cannot drop a reviewer, so compose over it the way
    // `review-gate.test.js` does — the review phase is the one cascade with a downstream consequence beyond its own
    // gap: the reviewer that never returns is the one holding `src/a.ts`, so `deduped` loses its first member and every
    // later `#idx` label renumbers around the gap.
    const scenario = fixScenario({
      issues: [
        issue({ file: 'src/a.ts', description: 'issue one', category: 'bug' }),
        issue({ file: 'src/b.ts', description: 'issue two', category: 'code-quality' }),
        issue({ file: 'src/c.ts', description: 'issue three', category: 'security' }),
      ],
      dedupe: () => null,
      validate: (subject, { idx }) => {
        // First validates, second doesn't.
        return idx === 0 ? { confirmed: true, rationale: 'confirmed' } : null;
      },
      // Fix fails for the one finding that validated — the only one the fix phase is ever asked about, so there is no
      // second arm to write here.
      fix: () => null,
    });
    const composed = await runWorkflow({
      scriptPath: SCRIPT,
      args: { fix: true, reviewers: 1, validators: 1 },
      agent: (call) => (call.label === 'review:core:bug' ? null : scenario.agent(call)),
    });
    // `runFix` hands `outcomeAt` the scenario as `run.scenario`, which is how it resolves a `#idx` through the numbering
    // the fixture recorded rather than indexing `fix.outcomes` positionally. A run composed by hand has to attach it the
    // same way, or `outcomeAt` has nothing to resolve against.
    const run = { ...composed, scenario };

    // Exactly the four phase gaps named below and nothing else. A count and not a `gaps.length > 1` threshold, because
    // a threshold would have held on any one of them alone. Three files are in scope here, so unlike the two-file
    // scenarios above this one clears the architecture-lens floor and carries no lens gap.
    expectGapCount(run, 4);
    expectGaps(run, GAP.reviewer('review:core:bug'));
    expectGaps(run, GAP.dedupe({ stalled: 1, scopes: 1, names: 'core' }));
    expectGaps(run, GAP.validation('src/c.ts:10'));
    expectGaps(run, GAP.fix('src/b.ts:10'));

    // The failed reviewer's `src/a.ts` never entered the union, so the list the `#idx` labels number is `src/b.ts` then
    // `src/c.ts` — the validator that confirmed `#0` was asked about `src/b.ts`, not the `src/a.ts` it would have been
    // asked about had every reviewer returned.
    expect(run.result.findings.map((subject) => subject.file)).toEqual(['src/b.ts']);

    // But its fix failed.
    expect(outcomeAt(run, 0).status).toBe('verify-failed');
  });

  it('includes the exception message in the gap when a fix pipeline throws', async () => {
    // A fix pipeline that throws rather than returning null: the phase-wide notice has to carry the underlying error,
    // and it has to sit alongside the upstream gaps rather than replacing them.
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
      fix: () => {
        throw new Error('Worktree creation failed: disk full');
      },
    });

    // Upstream gaps should still be present.
    expectGaps(run, GAP.dedupe({ stalled: 1, scopes: 1, names: 'core' }));
    expectGaps(run, GAP.validation('src/b.ts:10'));

    // The exception is caught and reported once, phase-wide, with its message attached — and not as the per-finding
    // 'Fix agent did not return' gap, which would read as an agent that answered nothing rather than one that died.
    expectGaps(run, GAP.fixPipeline('Worktree creation failed: disk full'));
    expectNoGap(run, GAP.fix());

    // The finding that validated should have a verify-failed status.
    expect(run.result.findings).toHaveLength(1);
    expect(outcomeAt(run, 0).status).toBe('verify-failed');
    expect(outcomeAt(run, 0).reason).toBe('fix/review pipeline did not return');
  });
});

describe('fix review failures after upstream gaps', () => {
  it('records review gap on top of dedupe and validation gaps', async () => {
    // Dedupe gap, then validation gap, then fix succeeds but review fails. One phase further than the fix-agent
    // cascade above, so the third gap comes from a different phase and the outcome is a rejection, not a failure.
    const run = await runFix({
      issues: [
        issue({ file: 'src/a.ts', description: 'first', category: 'bug' }),
        issue({ file: 'src/b.ts', description: 'second', category: 'bug' }),
      ],
      dedupe: () => null,
      validate: (_, { idx }) => idx === 0 ? { confirmed: true, rationale: 'confirmed' } : null,
      reviewFix: () => null,
    });

    // Gaps from all three failing phases: dedupe, the validator that rejected `src/b.ts`, and the review of the fix
    // for `src/a.ts`.
    expectGaps(run, GAP.dedupe({ stalled: 1, scopes: 1, names: 'core' }));
    expectGaps(run, GAP.validation('src/b.ts:10'));
    expectGaps(run, GAP.fixReview('src/a.ts:10'));

    // The fixer itself returned, so its own failure gap is not among them.
    expectNoGap(run, GAP.fix());

    // Only first finding validated but fix review failed, and nothing lands from an unreviewed fix.
    expect(run.result.findings.map((subject) => subject.file)).toEqual(['src/a.ts']);
    expect(outcomeAt(run, 0).status).toBe('review-rejected');
    expect(run.result.fix.commits).toEqual([]);
  });
});

describe('reconcile failures after upstream gaps', () => {
  it('records reconcile gap on top of dedupe, validation, fix, and review gaps', async () => {
    // Every phase accumulates a gap: dedupe fails, validation partially fails, fix partially fails, review partially
    // fails, and then reconcile fails to merge the two approved fixes that collide on one file.
    const run = await runFix({
      issues: [
        issue({ file: 'src/shared.ts', description: 'first issue', category: 'bug' }),
        issue({ file: 'src/shared.ts', description: 'second issue', category: 'bug' }),
        issue({ file: 'src/shared.ts', description: 'third issue', category: 'bug' }),
        issue({ file: 'src/other.ts', description: 'fourth issue', category: 'bug' }),
        issue({ file: 'src/another.ts', description: 'fifth issue', category: 'bug' }),
      ],
      dedupe: () => null,
      validate: (subject, { idx }) => {
        // First four validate (indices 0-3), fifth doesn't (index 4).
        return idx < 4 ? { confirmed: true, rationale: 'confirmed' } : null;
      },
      fix: (subject, { idx }) => {
        // First three succeed (indices 0-2, all touching the same file so they collide), fourth fails (index 3).
        if (idx < 3) {
          return {
            status: 'applied',
            sha: `deadbeef${String(idx).padStart(32, '0')}`,
            branch: `rrfix/wf_test/${idx}`,
            changedFiles: ['src/shared.ts'],
            reason: 'fixed',
          };
        }
        return null;
      },
      reviewFix: (subject, { idx }) => {
        // First two approve (indices 0-1), third doesn't (index 2).
        return idx < 2 ? { approved: true, objection: '' } : null;
      },
      reconcile: () => null,
    });

    // Exactly the five phase gaps, each naming the finding its phase lost. Five files are in scope, so there is no
    // architecture-lens gap to account for.
    expectGapCount(run, 5);
    expectGaps(run, GAP.dedupe({ stalled: 1, scopes: 1, names: 'core' }));
    expectGaps(run, GAP.validation('src/another.ts:10'));
    expectGaps(run, GAP.fix('src/other.ts:10'));
    expectGaps(run, GAP.fixReview('src/shared.ts:10'));
    expectGaps(run, GAP.reconcile());

    // Four findings validated; the two whose fixes were approved are the ones reconciliation was asked about, and it
    // left both unlanded.
    expect(run.result.findings).toHaveLength(4);
    expect(run.result.fix.outcomes.map((outcome) => outcome.status)).toEqual([
      'conflict-skipped',
      'conflict-skipped',
      'review-rejected',
      'verify-failed',
    ]);
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

    // Both types of dedupe gaps should be recorded, and the per-unit one has to name the scope that stalled.
    expectGaps(run, GAP.dedupe({ stalled: 1, scopes: 2, names: 'util' }));
    expectGaps(run, GAP.crossDedupe());

    // Nothing was merged anywhere — `core` reported no groups, `util` and the cross pass reported nothing at all — so
    // every finding must survive intact. Asserting the files, not just a non-zero count, is what catches a scope's
    // answer being mis-globalized into a merge the agent never asked for.
    expect(run.result.findings.map((subject) => subject.file)).toEqual([
      'src/core/a.ts',
      'src/core/b.ts',
      'src/util/c.ts',
      'src/util/d.ts',
    ]);
  });
});

describe('early abort phases', () => {
  it('partition failure aborts immediately', async () => {
    // Partition fails - should abort before review runs. The contrasting case, where a post-partition phase fails and
    // the run carries on accumulating gaps, is every other test in this file.
    const run = await runFix({
      issues: [issue()],
      units: [],
    });

    // The abort is immediate: no phase after partition runs, so the partition gap is the *only* gap. Asserting the
    // total subsumes a negative check per downstream phase, and covers the ones nobody thought to name.
    expectGapCount(run, 1);
    expectGaps(run, GAP.partition());
    expect(run.called(/^(review|dedupe|validate|fix|revise|reconcile)/).map((call) => call.label)).toEqual([]);
    expect(run.result.findings).toEqual([]);
  });
});
