/**
 * Cascading phase failures: what happens when several phases fail in one run.
 *
 * Each phase handles its own failure independently — survey and partition abort, a reviewer, an adjudicator or the
 * cross-unit pass records a gap and the run carries on — and a single phase failing on its own is pinned by the suite
 * that owns it: the cross pass returning nothing by `dedupe.test.js`, a verdict that never arrived by
 * `review-gate.test.js`, an aborting partition by `args.test.js`. What none of those can show is one run losing something
 * at several phases at once, where every gap has to survive the next phase's failure and stay attributed to the finding
 * it was lost on instead of collapsing into a single "the review failed" line. So a scenario here fails more than one
 * phase, and the assertions below are about the whole gap list rather than the presence of one substring somewhere in it.
 *
 * Adjudication is where the asymmetry lives, and it is why this file was rewritten when the two phases fused. A merge
 * that never arrived costs the round a merge: the findings are kept raw and one defect may be reported twice. A *verdict*
 * that never arrived costs the round the finding — it is dropped, and its gap is the only trace left of it. One agent now
 * owes both, so a single failure records both kinds of gap, and the two have to stay distinguishable in the list.
 *
 * The gaps a fix run accumulates are a separate list from a separate command, pinned in `tests/repo-review-fix/`.
 */

import { describe, expect, it } from 'vitest';

import { runWorkflow } from '../harness.js';
import { reviewScenario, issue, runReview, SCRIPT } from './scenario.js';

// --- Gap matchers ----------------------------------------------------------------------------------------------------
// One matcher per gap the script can record, matching the *whole* line. A substring probe for 'Adjudication did not
// complete' keeps passing once the message stops naming the file, the lines or the cause, and those details are the
// entire point of a gap: it is frequently the only surviving trace of the finding it is about. Every argument is
// optional and narrows the match, so `GAP.verdict()` is any missing-verdict gap and `GAP.verdict('src/b.ts:10')` is
// the one for that finding. Sites and scope names are matched literally, not as patterns, so a caller writes the file
// name it sees in the report.

const literal = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// `[\w-]+` and not `\w+` for the category, so the hyphenated ones — `code-quality`, `test-critique` — match too.
const perFinding = (phrase, site) =>
  new RegExp(`^${phrase} for a [\\w-]+ finding at ${site ? literal(site) : '.+'} — .+$`);

const GAP = {
  lens: () => /^Architecture lenses not run: only \d+ file\(s\) in scope — too small for a structural review\.$/,

  // An adjudicator that never came back. Counted in *agents* rather than scopes, because `--validators n` puts n of them
  // on one scope and chunking puts more than one on a large scope: "1 of 1 scope" would be the message a panel of three
  // recorded when two of the three failed.
  adjudicate: ({ stalled = '\\d+', agents = '\\d+', names } = {}) =>
    new RegExp(
      `^Adjudication did not return for ${stalled} of ${agents} agent\\(s\\) in round \\d+ ` +
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
  verdict: (site) => perFinding('Adjudication did not complete', site),
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

// Two findings in one unit, which is the smallest scope with both a merge and more than one verdict to lose.
const pair = [
  issue({ file: 'src/a.ts', description: 'first' }),
  issue({ file: 'src/b.ts', description: 'second' }),
];

describe('an adjudicator that never returns', () => {
  it('records a gap naming the agent, and loses every finding it was judging', async () => {
    // Both gaps at once, from the one failure, which is what makes this the phase worth a suite: the merge gap says the
    // survivors may double-report a defect, and the two verdict gaps say which findings are gone. The lens gap is the
    // third kind and rides along on every two-file scenario here. A count rather than a `gaps.length > 1` threshold,
    // because the lens gap alone already satisfied such a threshold.
    const run = await runReview({ issues: pair, adjudicate: () => null });

    expectGapCount(run, 4);
    expectGaps(run, GAP.lens());
    expectGaps(run, GAP.adjudicate({ stalled: 1, agents: 1, names: 'core' }));
    expectGaps(run, GAP.verdict('src/a.ts:10'));
    expectGaps(run, GAP.verdict('src/b.ts:10'));

    // Nothing survives, and that is the change fusing the phases made: a stage-1 dedupe that failed cost the round its
    // merging and kept its findings, because a separate validator would still judge them. There is no separate validator
    // now, so an unanswered scope is an unjudged scope, and an unjudged finding is not reported.
    expect(run.result.findings).toEqual([]);
  });

  it('reads a stall the same as a null return', async () => {
    // A stalled agent throws, which is how the real harness surfaces one killed by the no-progress watchdog — a
    // different failure mode from returning null, and the agent has to be reported as unanswered either way.
    const run = await runReview({
      issues: pair,
      adjudicate: () => {
        throw new Error('Agent stalled');
      },
    });

    expectGapCount(run, 4);
    expectGaps(run, GAP.adjudicate({ stalled: 1, agents: 1, names: 'core' }));
    expectGaps(run, GAP.verdict(), 2);
    expect(run.result.findings).toEqual([]);
  });

  it('keeps the findings when the rest of the panel returned', async () => {
    // The redundancy `--validators` buys, and the reason the merge gap and the verdict gaps are separate lines rather
    // than one. One member of a panel of three fails: its merge is lost, but the other two voted, so the quorum ran and
    // every finding is judged. The gap that remains is the honest one — an agent did not answer — and it names *which*
    // member, since a stall report that only said "the scope" could not say how much of the panel was lost.
    const run = await runReview({
      issues: pair,
      args: { validators: 3 },
      adjudicate: (call, { vote, subjects }) =>
        vote === 0
          ? null
          : { groups: [], verdicts: subjects.map(({ index }) => ({ index, confirmed: true, rationale: 'ok' })) },
    });

    expectGaps(run, GAP.adjudicate({ stalled: 1, agents: 3, names: 'core vote 1/3' }));
    expectNoGap(run, GAP.verdict());
    expect(run.result.findings).toHaveLength(2);
  });
});

describe('a verdict left out of an answer', () => {
  it('leaves the gap as the only trace when no verdict arrives', async () => {
    // The finer of the two failures, and the one no per-agent gap can express: the adjudicator answered, so no agent is
    // missing, and the finding is simply absent from `verdicts`. Nothing else in the run mentions it again.
    const run = await runReview({ issues: [issue()], validate: () => null });

    expectGaps(run, GAP.verdict('src/a.ts:10'));
    expectNoGap(run, GAP.adjudicate());
    expect(run.result.findings).toEqual([]);
  });

  it('reports only the findings that were judged when some verdicts are missing', async () => {
    const run = await runReview({
      issues: [
        issue({ file: 'src/a.ts', description: 'first', category: 'bug' }),
        issue({ file: 'src/b.ts', description: 'second', category: 'security' }),
      ],
      validate: (subject) => (subject.file === 'src/a.ts' ? { confirmed: true, rationale: 'confirmed' } : null),
    });

    // The gap names `src/b.ts`, the finding that was actually lost — not just "adjudication".
    expectGaps(run, GAP.verdict('src/b.ts:10'));
    expectNoGap(run, GAP.adjudicate());

    expect(run.result.findings).toHaveLength(1);
    expect(run.result.findings[0].file).toBe('src/a.ts');
  });
});

describe('a cascade through every phase that can record one', () => {
  it('accumulates a reviewer, an adjudicator and a verdict gap in one run, each naming what it lost', async () => {
    // `runReview` drives `reviewScenario`'s agent as-is and so cannot drop a reviewer, so compose over it the way
    // `review-gate.test.js` does — the review phase is the one failure with a downstream consequence beyond its own gap:
    // the agent that never returns is the one holding `src/b.ts`, so the scope the adjudicators are given loses a member.
    //
    // The dropped agent is the Sonnet group, which under the default arm carries `code-quality` and so exactly one of
    // these three findings. Dropping the Opus group instead would lose two of them — `bug` and `security` are one agent
    // now — and with them the survivor this cascade needs in order to produce a verdict gap and a confirmed finding at
    // the same time.
    //
    // A panel of three, because the three gaps are otherwise mutually exclusive: an adjudicator that failed outright
    // leaves no verdicts to be selectively missing, so the merge gap and the verdict gap could not both be about a
    // finding that survived. One member fails; the other two answer about `src/a.ts` and stay silent about `src/c.ts`.
    const scenario = reviewScenario({
      issues: [
        issue({ file: 'src/a.ts', description: 'issue one', category: 'bug' }),
        issue({ file: 'src/b.ts', description: 'issue two', category: 'code-quality' }),
        issue({ file: 'src/c.ts', description: 'issue three', category: 'security' }),
      ],
      adjudicate: (call, { vote, subjects }) =>
        vote === 0
          ? null
          : {
              groups: [],
              verdicts: subjects.flatMap(({ index, file }) =>
                file === 'src/a.ts' ? [{ index, confirmed: true, rationale: 'confirmed' }] : [],
              ),
            },
    });
    const run = await runWorkflow({
      scriptPath: SCRIPT,
      args: { validators: 3 },
      agent: (call) => (call.label === 'review:core:sonnet' ? null : scenario.agent(call)),
    });

    // Exactly the three phase gaps named below and nothing else. A count and not a `gaps.length > 1` threshold, because
    // a threshold would have held on any one of them alone. Three files are in scope here, so unlike the two-file
    // scenarios above this one clears the architecture floor and carries no lens gap.
    expectGapCount(run, 3);
    expectGaps(run, GAP.reviewer('review:core:sonnet'));
    expectGaps(run, GAP.adjudicate({ stalled: 1, agents: 3, names: 'core vote 1/3' }));
    expectGaps(run, GAP.verdict('src/c.ts:10'));

    // The failed reviewer's `src/b.ts` never entered the scope at all, so it has no gap of its own beyond the reviewer's:
    // the run cannot name a finding it was never told about. `src/c.ts` did enter, and is named.
    expect(run.result.findings.map((subject) => subject.file)).toEqual(['src/a.ts']);
  });
});

describe('cross-unit dedupe failures', () => {
  it('records an adjudicator gap and a cross-unit gap in the same run', async () => {
    // The two halves of what used to be one phase, failing independently. Each unit needs more than one finding for the
    // merge half to have anything to do, and two units are what make the cross pass run at all.
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
      // `core` is adjudicated cleanly; `util`'s adjudicator never answers.
      adjudicate: (call, { subjects }) =>
        call.label.includes(':util')
          ? null
          : { groups: [], verdicts: subjects.map(({ index }) => ({ index, confirmed: true, rationale: 'ok' })) },
      dedupe: () => null,
    });

    // The scope that stalled has to be named, and the count has to be over agents the round actually spawned — one per
    // unit here, since a two-finding scope is well under the chunk cap and `--validators` is 1 through `runReview`.
    expectGaps(run, GAP.adjudicate({ stalled: 1, agents: 2, names: 'util' }));
    expectGaps(run, GAP.crossDedupe());
    expectGaps(run, GAP.verdict(), 2);

    // `util`'s findings went into the cross pass — an unanswered scope is kept raw, which is what the merge gap says —
    // and out of the report, because nothing judged them. `core`'s two survive. Asserting the files, not just a count,
    // is what catches a scope's answer being mis-globalized into a merge the agent never asked for.
    expect(run.result.findings.map((subject) => subject.file)).toEqual(['src/core/a.ts', 'src/core/b.ts']);
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
    expect(run.called(/^(review|adjudicate|dedupe)/).map((call) => call.label)).toEqual([]);
    expect(run.result.findings).toEqual([]);
  });
});
