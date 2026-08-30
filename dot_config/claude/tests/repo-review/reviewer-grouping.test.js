/**
 * How many agents one unit costs to review.
 *
 * The roster names six reviewers, and every unit used to spend one agent on each of them. With the unit ceiling at 8 that
 * is 48 leaf agents per round before dedupe, validation or the architecture pass — and it is the single largest line in
 * the cost that exhausted a session limit in 41 minutes without finishing round 3. `--reviewers-per-unit 2` groups the
 * roster by the model each reviewer runs on, so one Opus agent covers `bug` and `security` and one Sonnet agent covers the
 * rest: the same six axes, a third of the agents.
 *
 * What that trade costs in *finding quality* is not measurable here — `scenario.js` fakes every agent, so a grouped
 * reviewer in this suite is exactly as attentive as six separate ones. That is what the A/B on a real repository is for.
 * What is measurable here, and is all this file claims, is that the two arms cover the same categories, that a grouped
 * agent is told about every axis it holds and constrained to answer under one of them, and that a value naming neither arm
 * stops the run instead of quietly picking one.
 *
 * The label vocabularies are the seam between the arms: `review:core:bug` is one of six, `review:core:opus` is one of two.
 * Suites that only need to name *an* agent for a unit read `REVIEW_GROUP_KEYS` from the fixture rather than writing either
 * vocabulary out, so that flipping the default does not rewrite them — see `unit-labels.test.js` and
 * `partition-ceiling.test.js`.
 */

import { describe, expect, it } from 'vitest';

import { runWorkflow } from '../harness.js';
import {
  internals,
  issue,
  REVIEWER_KEYS,
  REVIEW_GROUP_KEYS,
  runReview,
  SCRIPT,
  withFingerprints,
} from './scenario.js';

// Two findings in one unit, in two different reviewers' categories on two different models — the smallest arrangement in
// which grouping is observable at all, since one agent's answer has to be routed under two categories.
const spread = [
  issue({ description: 'frame length unchecked', file: 'src/a.ts', category: 'bug' }),
  issue({ description: 'stale commented-out branch', file: 'src/b.ts', category: 'code-quality' }),
];

// The axes a grouped prompt lists, read back out of the prompt rather than out of the roster: the roster is the input and
// the prompt is the artifact, and what this suite is about is whether the second names everything in the first.
const axesIn = (prompt) => [...prompt.matchAll(/^\d+\. \*\*.+?\*\* — category `(.+?)`\./gm)].map(([, key]) => key);

// A run that must not spawn an agent. `runReview` cannot express this one: it resolves the run's scope through the
// script's own `narrowToScope`, and an aborted script never declares it.
const abortedRun = (args) =>
  runWorkflow({
    scriptPath: SCRIPT,
    args,
    agent: (call) => {
      throw new Error(`An agent ran despite the abort: ${call.label}`);
    },
  });

describe('reviewerGroups', () => {
  it('collapses the roster into one agent per model, in the order the roster first names each', async () => {
    const { REVIEWERS, reviewerGroups } = await internals();
    const grouped = reviewerGroups(REVIEWERS);

    // Order matters because it is the order the axes are numbered in and the order the labels appear in `/workflows`;
    // `Map` iteration gives insertion order, which is first-mention in the roster.
    expect(grouped.map((group) => group.model)).toEqual(['opus', 'sonnet']);
    expect(grouped.map((group) => group.members.map((member) => member.key))).toEqual([
      ['bug', 'security'],
      ['claude-md', 'code-quality', 'consistency', 'test-critique'],
    ]);

    // The property the numbers are a consequence of: every reviewer is in exactly one group, and none was dropped.
    expect(grouped.flatMap((group) => group.members.map((member) => member.key)).sort()).toEqual(
      [...REVIEWER_KEYS].sort(),
    );
  });

  it('groups by the model a reviewer runs on and not by whether its findings are high-risk', async () => {
    // The two look interchangeable and are not. `highRisk` marks `bug`, `consistency` and `security`, so grouping by it
    // would move `consistency` onto Opus — undoing the roster's deliberate pairing of a cheap Sonnet reviewer with an
    // expensive Opus validator — and leave `test-critique` alone on Sonnet with `claude-md` and `code-quality`.
    const { REVIEWERS, reviewerGroups } = await internals();
    const byKey = new Map(reviewerGroups(REVIEWERS).flatMap((g) => g.members.map((m) => [m.key, g.model])));

    expect(REVIEWERS.filter((reviewer) => reviewer.highRisk).map((reviewer) => reviewer.key)).toEqual([
      'bug',
      'consistency',
      'security',
    ]);
    expect(byKey.get('consistency')).toBe('sonnet');
    expect(byKey.get('security')).toBe('opus');
  });

  it('thins a group when the roster it is given is gated, rather than being applied twice', async () => {
    // Derived from whatever roster it is handed, which is what lets the `claude-md` gate stay in one place: a repository
    // with no `CLAUDE.md` drops that reviewer from the roster and the Sonnet agent simply runs one axis lighter.
    const { REVIEWERS, reviewerGroups } = await internals();
    const gated = reviewerGroups(REVIEWERS.filter((reviewer) => reviewer.key !== 'claude-md'));

    expect(gated.map((group) => group.members.map((member) => member.key))).toEqual([
      ['bug', 'security'],
      ['code-quality', 'consistency', 'test-critique'],
    ]);
  });

  it('yields no group for a model the roster no longer names', async () => {
    // The degenerate end of the same rule: a gate that emptied a model's group must not leave an agent behind with no
    // axes to review, which is what a hand-listed `['opus', 'sonnet']` would have done.
    const { REVIEWERS, reviewerGroups } = await internals();
    const sonnetOnly = REVIEWERS.filter((reviewer) => reviewer.model === 'sonnet');

    expect(reviewerGroups(sonnetOnly).map((group) => group.model)).toEqual(['sonnet']);
    expect(reviewerGroups([])).toEqual([]);
  });
});

describe('the default arm', () => {
  it('spends one agent per model on a unit, labelled by the model', async () => {
    const run = await runReview({ issues: spread });

    expect(run.called(/^review:core:/).map((call) => call.label)).toEqual(
      REVIEW_GROUP_KEYS.map((model) => `review:core:${model}`),
    );

    // And each runs on the model its own group is named for, which is the whole basis of the grouping: a group whose
    // agent ran on the other model would be reviewing `bug` on Sonnet.
    expect(run.called(/^review:core:/).map((call) => call.opts.model)).toEqual(REVIEW_GROUP_KEYS);
  });

  it('covers every category the six-arm covers, once each', async () => {
    // The claim that makes this a cost cut rather than a narrowing of the review. Asserted over the prompts, because the
    // axes are what an agent was actually told to look for — a category present in the schema's enum but named in no
    // prompt is a category nothing is looking for.
    const run = await runReview({ issues: spread });
    const covered = run.called(/^review:core:/).flatMap((call) => axesIn(call.prompt));

    expect(covered.sort()).toEqual([...REVIEWER_KEYS].sort());
  });

  it('numbers the axes and says that reporting nothing under one is a claim about the code', async () => {
    // The failure mode grouping introduces, and the only defence against it available in a prompt: asked for four things
    // at once, an agent answers the first well and the rest as an afterthought — and an axis answered as an afterthought
    // is indistinguishable in the output from an axis that found nothing.
    const run = await runReview({ issues: spread });
    const [, sonnet] = run.called(/^review:core:/);

    expect(sonnet.prompt).toContain('reviewing one unit on 4 distinct axes');
    expect(sonnet.prompt).toContain('an axis you report nothing under is a claim that the unit is clean on it');
    expect(axesIn(sonnet.prompt)).toEqual(['claude-md', 'code-quality', 'consistency', 'test-critique']);

    // The roster's own instruction travels with each axis rather than being paraphrased into a group prompt, so a
    // reviewer's rules cannot differ between the arms.
    const { REVIEWERS } = await internals();

    for (const reviewer of REVIEWERS.filter((entry) => entry.model === 'sonnet')) {
      expect(sonnet.prompt).toContain(reviewer.instruction);
    }
  });

  it('narrows the schema enum to the axes the agent was given', async () => {
    // Belt as well as braces, and the braces are the weaker of the two: a schema mismatch is retried at the tool-call
    // layer, while a prose instruction that goes unheeded arrives as a real finding filed under another reviewer's
    // category — which then picks the wrong validator model and the wrong known-findings list.
    const run = await runReview({ issues: spread });
    const enumOf = (call) => call.opts.schema.properties.issues.items.properties.category.enum;
    const [opus, sonnet] = run.called(/^review:core:/);

    expect(enumOf(opus)).toEqual(['bug', 'security']);
    expect(enumOf(sonnet)).toEqual(['claude-md', 'code-quality', 'consistency', 'test-critique']);
  });

  it('narrows the enum without disturbing the schema it narrows', async () => {
    // `issuesSchema` spreads rather than mutates. Mutating `ISSUE` in place would narrow the enum for every later
    // agent too — including the architecture agent, whose only category is one no group holds.
    const { ISSUES_SCHEMA, issuesSchema } = await internals();
    const narrowed = issuesSchema(['bug']);

    expect(narrowed.properties.issues.items.properties.category.enum).toEqual(['bug']);
    expect(ISSUES_SCHEMA.properties.issues.items.properties.category.enum).toContain('architecture');
    expect(narrowed.required).toEqual(ISSUES_SCHEMA.required);
    expect(narrowed.properties.issues.items.required).toEqual(ISSUES_SCHEMA.properties.issues.items.required);
  });
});

describe('--reviewers-per-unit 6', () => {
  const six = { reviewersPerUnit: 6 };

  it('restores one agent per reviewer, labelled by its category', async () => {
    const run = await runReview({ issues: spread, args: six });

    expect(run.called(/^review:core:/).map((call) => call.label)).toEqual(
      REVIEWER_KEYS.map((key) => `review:core:${key}`),
    );
  });

  it('keeps the single-reviewer prompt, so the control arm is the review this replaced', async () => {
    // This arm exists to be compared against, which only works if it is unchanged. A group of one would have been the
    // tidier implementation and would have made the A/B measure two changes at once.
    const run = await runReview({ issues: spread, args: six });
    const [bug] = run.called('review:core:bug');
    const { REVIEWERS } = await internals();

    expect(bug.prompt.startsWith(`You are the ${REVIEWERS[0].title} reviewer.`)).toBe(true);
    expect(bug.prompt).toContain('the category "bug"');
    expect(bug.prompt).not.toContain('distinct axes');
    expect(axesIn(bug.prompt)).toEqual([]);
  });

  it('leaves the category enum alone, because the script stamps the category itself', async () => {
    const run = await runReview({ issues: spread, args: six });
    const { ISSUES_SCHEMA } = await internals();

    expect(run.called('review:core:bug')[0].opts.schema).toEqual(ISSUES_SCHEMA);
  });
});

describe('the category a grouped finding is recorded under', () => {
  // Under one agent per reviewer the script stamps the reviewer's key over whatever the agent answered, so the field is
  // not really the agent's to get wrong. A grouped agent chooses, and these two tests are the choice being honoured and
  // the choice being out of range.
  const groupedRun = (issues) =>
    runReview({
      issues: spread,
      review: (_call, { key }) => ({ issues: key === 'opus' ? issues : [] }),
    });

  it('takes the agent’s answer when it names one of the agent’s own axes', async () => {
    // Stamping the group's first category would file every Opus finding as a bug, `security` included — and the category
    // is one of the three fields a fingerprint is built from, so the ledger would hold it under the wrong name for good.
    const run = await groupedRun([spread[0], { ...spread[1], category: 'security', file: 'src/b.ts' }]);

    expect(run.result.findings.map((finding) => finding.category).sort()).toEqual(['bug', 'security']);
    expect(run.result.gaps.filter((gap) => gap.includes('unreliable'))).toEqual([]);
  });

  it('coerces an answer outside them, and says once per agent that the category is unreliable', async () => {
    // Coerced rather than dropped: a mis-filed finding picks the wrong validator model and the wrong feedback list, while
    // a dropped one is a defect the run looked at and then discarded — and only the first is recoverable by reading the
    // report. Said once per agent rather than once per finding, because an agent that misread the instruction misread it
    // for everything it reported, and one gap per finding would bury every other gap in the round.
    const run = await groupedRun(spread);
    const gap = run.result.gaps.find((entry) => entry.includes('unreliable'));

    expect(gap).toContain('review:core:opus reported 1 of 2 finding(s)');
    expect(gap).toContain('outside the bug, security axes it was given');
    expect(gap).toContain("recorded as 'bug'");
    expect(run.result.gaps.filter((entry) => entry.includes('unreliable'))).toHaveLength(1);

    // The stray is kept, under the group's first category.
    expect(run.result.findings.map((finding) => [finding.file, finding.category]).sort()).toEqual([
      ['src/a.ts', 'bug'],
      ['src/b.ts', 'bug'],
    ]);
  });
});

describe('a --reviewers-per-unit naming neither arm', () => {
  // Deliberately not `positiveIntOr`, which every other count knob is normalized through. Its contract is a silent
  // fallback, and silently falling back here would make `--reviewers-per-unit 4` a run that reports the coverage of six
  // agents and spent two — the one thing an A/B knob must never do to the arm it is measuring.
  it('aborts the review rather than falling back to either arm', async () => {
    const run = await abortedRun({ reviewersPerUnit: 4 });

    expect(run.result.gaps.join(' ')).toContain('`--reviewers-per-unit` must be 2 or 6 but received \'4\'');
    expect(run.result.gaps.join(' ')).toContain('Review aborted');
    expect(run.called(/./)).toEqual([]);
  });

  it('carries the findings it was handed, so an unusable knob costs a round and not the ledger', async () => {
    // The guard sits *below* `knownFindings` for this reason, unlike `--effort`'s, which aborts with `findings: []`
    // because it is declared above it. A rejected flag on round 4 of a review must not discard rounds 1 through 3.
    const held = [issue({ description: 'held from an earlier round' })];
    const run = await abortedRun({ reviewersPerUnit: 'lots', round: 4, knownFindings: held });

    // Fingerprinted on the way in, which happens above the guard: the ledger's key is content-addressed, so a
    // finding read from `args` is named before anything decides whether this round can run.
    expect(run.result.findings).toEqual(withFingerprints(held));
    expect(run.result.round).toBe(4);
    expect(run.result.newFindings).toBe(0);
    expect(run.result.gaps.join(' ')).toContain("received 'lots'");
  });
});
