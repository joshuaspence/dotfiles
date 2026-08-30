/**
 * Cascading phase failures: what happens when several phases fail in one run.
 *
 * Each phase handles its own failure independently — survey and partition abort, a reviewer, a dedupe scope or a
 * validator records a gap and the run carries on — and a single phase failing on its own is pinned by the suite that
 * owns it: dedupe returning nothing by `dedupe.test.js`, validation by `review-gate.test.js`, an aborting partition by
 * `args.test.js`. What none of those can show is one run losing something at several phases at once, where every gap has
 * to survive the next phase's failure and stay attributed to the finding it was lost on instead of collapsing into a
 * single "the review failed" line. So a scenario here fails more than one phase, and the assertions below are about the
 * whole gap list rather than the presence of one substring somewhere in it.
 *
 * The gaps a fix run accumulates are a separate list from a separate command, pinned in `tests/repo-review-fix/`.
 */

import { describe, expect, it } from 'vitest';

import { runWorkflow } from '../harness.js';
import { reviewScenario, issue, runReview, SCRIPT } from './scenario.js';

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
    const run = await runReview({
      issues: [
        issue({ file: 'src/a.ts', description: 'first' }),
        issue({ file: 'src/b.ts', description: 'second' }),
      ],
      dedupe: () => null,
    });

    // Dedupe gap should be recorded with specific message about unit scope failure.
    expectGaps(run, GAP.dedupe({ stalled: 1, scopes: 1, names: 'core' }));

    // Validation ran cleanly, so it recorded nothing — the dedupe gap is the only one about a finding.
    expectNoGap(run, GAP.validation());

    // Both findings are still reported: dedupe failing costs the round its merging, not its findings. They may name one
    // defect twice, which is what the gap says.
    expect(run.result.findings).toHaveLength(2);
  });

  it('records a gap when the dedupe agent stalls (throws) but continues to validation', async () => {
    // A stalled agent throws, which is how the real harness surfaces one killed by the no-progress watchdog — a
    // different failure mode from returning null, and the scope has to be reported as unanswered either way.
    const run = await runReview({
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

    // A stall does not block the downstream phases either.
    expect(run.result.findings).toHaveLength(2);
  });
});

describe('dedupe failures cascading into validation', () => {
  it('passes raw findings to validation when dedupe fails, accumulating both gaps', async () => {
    // Dedupe fails to return for a unit, so findings stay raw. Validation then also fails.
    const run = await runReview({
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
    const run = await runReview({
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

describe('validation failures', () => {
  it('leaves the gap as the only trace when every validator fails', async () => {
    const run = await runReview({
      issues: [issue()],
      validate: () => null,
    });

    expectGaps(run, GAP.validation('src/a.ts:10'));
    expect(run.result.findings).toEqual([]);
  });

  it('reports only the findings that passed validation when some validators fail', async () => {
    // Two findings: first validator succeeds, second fails.
    const run = await runReview({
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
  });
});

describe('a cascade through every phase that can record one', () => {
  it('accumulates a reviewer, a dedupe and a validation gap in one run, each naming what it lost', async () => {
    // `runReview` drives `reviewScenario`'s agent as-is and so cannot drop a reviewer, so compose over it the way
    // `review-gate.test.js` does — the review phase is the one failure with a downstream consequence beyond its own gap:
    // the reviewer that never returns is the one holding `src/a.ts`, so `deduped` loses its first member and every later
    // `#idx` label renumbers around the gap.
    const scenario = reviewScenario({
      issues: [
        issue({ file: 'src/a.ts', description: 'issue one', category: 'bug' }),
        issue({ file: 'src/b.ts', description: 'issue two', category: 'code-quality' }),
        issue({ file: 'src/c.ts', description: 'issue three', category: 'security' }),
      ],
      dedupe: () => null,
      validate: (subject, { idx }) => (idx === 0 ? { confirmed: true, rationale: 'confirmed' } : null),
    });
    const run = await runWorkflow({
      scriptPath: SCRIPT,
      args: { reviewers: 1, validators: 1 },
      agent: (call) => (call.label === 'review:core:bug' ? null : scenario.agent(call)),
    });

    // Exactly the three phase gaps named below and nothing else. A count and not a `gaps.length > 1` threshold, because
    // a threshold would have held on any one of them alone. Three files are in scope here, so unlike the two-file
    // scenarios above this one clears the architecture-lens floor and carries no lens gap.
    expectGapCount(run, 3);
    expectGaps(run, GAP.reviewer('review:core:bug'));
    expectGaps(run, GAP.dedupe({ stalled: 1, scopes: 1, names: 'core' }));
    expectGaps(run, GAP.validation('src/c.ts:10'));

    // The failed reviewer's `src/a.ts` never entered the union, so the list the `#idx` labels number is `src/b.ts` then
    // `src/c.ts` — the validator that confirmed `#0` was asked about `src/b.ts`, not the `src/a.ts` it would have been
    // asked about had every reviewer returned. That is also why only two findings were validated at all.
    expect(run.result.findings.map((subject) => subject.file)).toEqual(['src/b.ts']);
    expect(run.called(/^validate:/)).toHaveLength(2);
  });
});

describe('cross-unit dedupe failures', () => {
  it('records both per-unit and cross-unit dedupe gaps', async () => {
    // Multiple units, per-unit dedupe partially fails, cross-unit dedupe also fails.
    // Each unit needs multiple findings for per-unit dedupe to run.
    const run = await runReview({
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
    const run = await runReview({
      issues: [issue()],
      units: [],
    });

    // The abort is immediate: no phase after partition runs, so the partition gap is the *only* gap. Asserting the
    // total subsumes a negative check per downstream phase, and covers the ones nobody thought to name.
    expectGapCount(run, 1);
    expectGaps(run, GAP.partition());
    expect(run.called(/^(review|dedupe|validate|fix|revise)/).map((call) => call.label)).toEqual([]);
    expect(run.result.findings).toEqual([]);
  });
});
