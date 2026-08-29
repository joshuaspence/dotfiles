/**
 * Unit names reach `/workflows` inside agent labels, and the partition agent writes them as prose.
 *
 * `review:Wire Protocol Layer:code-quality` was observed clipped to about 40 columns, which cost the category — the one
 * part of that label that says which of six reviewers the row is. The runtime does not shorten a label it is handed, so
 * the budget is the script's to spend: these tests hold the slug to a size where the identifying segments survive, and
 * hold it to a shape that cannot break the `kind:unit:category` label grammar the test scenario parses.
 */

import { describe, expect, it } from 'vitest';

import { fixScenario, internals, issue, parseLabel, REVIEWER_KEYS, runFix } from './scenario.js';

// What a label costs before the unit name is added: the longest reviewer key, plus `review:` and the joining colon.
const LONGEST_KEY = REVIEWER_KEYS.reduce((a, b) => (b.length > a.length ? b : a));
const FIXED_COST = 'review:'.length + 1 + LONGEST_KEY.length;

// The clip observed in `/workflows`, in columns. Not a constant found in the harness — the label is stored whole there,
// so this is measured from the truncation itself: 39 visible characters and an ellipsis.
const OBSERVED_BUDGET = 40;

describe('unit slug', () => {
  it('lower-cases and kebab-cases a prose name', async () => {
    const { unitSlug } = await internals();

    expect(unitSlug('Wire Protocol')).toBe('wire-protocol');
    expect(unitSlug('CLI Entry Points')).toBe('cli-entry-points');
  });

  it('strips the characters that would break the label grammar', async () => {
    // A colon is the real hazard: `review:api:v2:bug` has four segments, and both `/workflows` and the test scenario
    // read the second as the unit and the third as the category. Slashes and spaces are merely noise by comparison.
    const { unitSlug } = await internals();

    expect(unitSlug('api:v2')).toBe('api-v2');
    expect(unitSlug('src/core/wire')).toBe('src-core-wire');
    expect(unitSlug('  padded  ')).toBe('padded');
    expect(unitSlug('Ünïcödé')).toBe('n-c-d');
  });

  it('splits camel case, so one unit named two ways gets one slug', async () => {
    // Lower-casing first would throw the boundary away and leave a single 24-character word, which then has nowhere to
    // be cut but mid-word. It also means the agent's choice of style stops changing the label.
    const { unitSlug } = await internals();

    expect(unitSlug('AuthenticationMiddleware')).toBe(unitSlug('Authentication Middleware'));
  });

  it('cuts an over-long slug on a word boundary rather than mid-word', async () => {
    // `wire-protocol-la` reads as a typo; `wire-protocol` reads as a name. Same information, and one of the two looks
    // like the script is broken.
    const { unitSlug } = await internals();

    expect(unitSlug('Wire Protocol Layer')).toBe('wire-protocol');
  });

  it('keeps a slug the cap ends exactly, which has no partial segment to drop', async () => {
    // Cutting back here would throw away a whole word for nothing.
    const { unitSlug, UNIT_SLUG_CAP } = await internals();

    expect(unitSlug('the http request handling layer')).toBe('the-http-request');
    expect(unitSlug('the http request handling layer')).toHaveLength(UNIT_SLUG_CAP);
  });

  it('clips rather than cutting back when a cut would leave almost nothing', async () => {
    // A name that says nothing is worse than one that looks truncated: `a-superlongwordhere` cut on its only boundary
    // is `a`, and `dedupe:a` names no unit a reader could place.
    const { unitSlug, UNIT_SLUG_CAP } = await internals();

    expect(unitSlug('a superlongwordhere')).toBe('a-superlongwordh');
    expect(unitSlug('x'.repeat(200))).toHaveLength(UNIT_SLUG_CAP);
  });

  it('caps the slug so a label keeps its unit and its category', async () => {
    // The property the cap is chosen for, asserted against the longest reviewer key rather than a copied number: a
    // label built from any name at all has to fit the budget, so what a round tag overflows is only the round tag.
    const { unitSlug, UNIT_SLUG_CAP } = await internals();

    expect(FIXED_COST + UNIT_SLUG_CAP).toBeLessThanOrEqual(OBSERVED_BUDGET);

    for (const name of ['Wire Protocol Layer', 'AuthenticationMiddleware', 'x'.repeat(200), 'a b c d e f g h i j']) {
      expect(`review:${unitSlug(name)}:${LONGEST_KEY}`.length).toBeLessThanOrEqual(OBSERVED_BUDGET);
    }
  });
});

describe('unit slug collisions', () => {
  it('numbers units whose distinct names slug to the same thing', async () => {
    // Cutting on a word boundary is what makes this reachable: two real, different units both arrive as
    // `wire-protocol`, and two rows under one label in `/workflows` are two rows a reader cannot tell apart.
    const { withUnitSlugs } = await internals();

    const slugged = withUnitSlugs([
      { name: 'Wire Protocol Layer', paths: ['wire'] },
      { name: 'Wire Protocol Framing', paths: ['framing'] },
      { name: 'Wire Protocol Tests', paths: ['tests'] },
    ]);

    expect(slugged.map((unit) => unit.slug)).toEqual(['wire-protocol', 'wire-protocol-2', 'wire-protocol-3']);
  });

  it('numbers a unit off the names the dedupe phase reserves for itself', async () => {
    // `dedupe:<name>` is one namespace, and the dedupe phase mints two names in it that no unit passes through here:
    // the bucket for findings no unit claimed, and the prefix every cross-unit chunk carries. `Cross-Cutting Concerns`
    // is a name a partition agent plausibly writes and it slugs onto the first one exactly, so without a reservation
    // two stage-1 agents would run under one label — and a stall report naming it could not say which one stalled.
    const { withUnitSlugs, DEDUPE_CROSS_SLUG, DEDUPE_UNCLAIMED_SLUG } = await internals();

    const slugged = withUnitSlugs([
      { name: 'Cross-Cutting Concerns', paths: ['a'] },
      { name: 'cross cutting', paths: ['b'] },
      { name: 'Cross', paths: ['c'] },
    ]);

    expect(slugged.map((unit) => unit.slug)).toEqual([
      `${DEDUPE_UNCLAIMED_SLUG}-2`,
      `${DEDUPE_UNCLAIMED_SLUG}-3`,
      `${DEDUPE_CROSS_SLUG}-2`,
    ]);
  });

  it('names a unit whose name slugs away to nothing', async () => {
    // `???` and `---` leave an empty string, and `dedupe:` with nothing after it names no unit at all.
    const { withUnitSlugs } = await internals();

    expect(withUnitSlugs([{ name: '???', paths: ['a'] }, { name: '', paths: ['b'] }]).map((u) => u.slug)).toEqual([
      'unit-1',
      'unit-2',
    ]);
  });

  it('keeps the name the agent wrote, which is what a reviewer is told to review', async () => {
    // The slug is for labels. Prose belongs in the prompt, where "Wire Protocol Layer" says more than its slug does.
    const { withUnitSlugs } = await internals();

    const [unit] = withUnitSlugs([{ name: 'Wire Protocol Layer', summary: 'framing', paths: ['wire'] }]);

    expect(unit).toMatchObject({ name: 'Wire Protocol Layer', summary: 'framing', slug: 'wire-protocol' });
  });
});

describe('labels built from a finding', () => {
  it('round-trips through the parser every scenario reads them with', async () => {
    // `parseLabel` restates this grammar as a regex, which it has to — parsing is not something the builders can do.
    // Asserting the two against each other is what stops the restatement drifting: a builder that started emitting
    // `vote 1 of 3` would leave every fake agent answering for finding 0, and the scenarios would fail far from here.
    const { findingTag, voteTag, attemptTag } = await internals();
    const tag = findingTag(issue({ category: 'bug' }), 3);

    expect(parseLabel(`validate:${tag}${voteTag(2, 3)}`)).toMatchObject({
      kind: 'validate',
      category: 'bug',
      idx: 3,
      vote: 2,
    });

    expect(parseLabel(`revise:${tag}${attemptTag(1)}`)).toMatchObject({ kind: 'revise', idx: 3, attempt: 1 });

    // A single validator or reviewer carries no vote segment, and the original fix attempt no attempt segment — the
    // defaults the parser fills in have to be the ones the omission means.
    expect(parseLabel(`fix:${tag}${attemptTag(0)}`)).toMatchObject({ kind: 'fix', idx: 3, attempt: 0, vote: 0 });
    expect(parseLabel(`review-fix:${tag}${voteTag(0, 1)}`)).toMatchObject({ kind: 'review-fix', idx: 3, vote: 0 });
  });
});

describe('labels built from a unit', () => {
  const units = [{ name: 'Wire Protocol Layer', summary: 'framing', paths: ['wire'] }];
  const issues = [issue({ file: 'wire/frame.py' }), issue({ file: 'wire/parse.py' })];

  it('labels both the reviewers and the dedupe scope with the slug', async () => {
    // Both phases have to agree, since they are read as one tree in `/workflows`. Asserting them together is what
    // catches one of them still interpolating `unit.name`.
    const run = await runFix({ issues, units });

    expect(run.called(/^review:/).map((call) => call.label)).toContain('review:wire-protocol:code-quality');
    expect(run.called(/^dedupe/).map((call) => call.label)).toEqual(['dedupe:wire-protocol:high']);
    expect(run.called(/^review:Wire/)).toHaveLength(0);
  });

  it('still tells the reviewer the unit by the name the partition gave it', async () => {
    const run = await runFix({ issues, units });
    const [reviewer] = run.called('review:wire-protocol:bug');

    expect(reviewer.prompt).toContain('Review this unit: "Wire Protocol Layer".');
  });

  it('asks the partition agent for a name it will not have to shorten', async () => {
    // Enforcement is in the script, so this is only an optimisation — but a name chosen short beats one cut short, and
    // the prompt has to name the same cap the script applies or it is asking for the wrong thing.
    const { partitionPrompt, UNIT_SLUG_CAP } = await internals();

    const prompt = partitionPrompt({ languages: [], structure: [] }, 10);

    expect(prompt).toContain('`kebab-case`');
    expect(prompt).toContain(`most ${UNIT_SLUG_CAP} characters`);
  });
});

describe('reading a unit back out of a label', () => {
  // The slug in the label is all the test scenario has to recover a unit from, and it used to do so by prefix-matching a
  // re-normalized name. Every per-unit assertion in this suite rests on that, and a miss read as "the whole repository"
  // — so a wrong answer widened a reviewer's scope instead of failing, and those assertions passed for no reason.
  const reported = (run, label) => run.called(label)[0].result.issues.map((subject) => subject.file);

  it('resolves a slug that collided with another unit and was numbered', async () => {
    // `wire-protocol-2` is no prefix of `wire-protocol-framing`, so the second unit's reviewers matched nothing.
    const units = [
      { name: 'Wire Protocol Layer', summary: 'framing', paths: ['wire'] },
      { name: 'Wire Protocol Framing', summary: 'codecs', paths: ['framing'] },
    ];
    const issues = [issue({ file: 'wire/frame.py' }), issue({ file: 'framing/codec.py' })];
    const run = await runFix({ issues, units, args: { fix: false } });

    expect(reported(run, 'review:wire-protocol:bug')).toEqual(['wire/frame.py']);
    expect(reported(run, 'review:wire-protocol-2:bug')).toEqual(['framing/codec.py']);
  });

  it('resolves a slug the script split on camel case, and one another name is a prefix of', async () => {
    // Two failures at once: `AuthMiddleware` slugs to `auth-middleware` but re-normalized to `authmiddleware`, and
    // `core` is a prefix of `core-utils`, so the shorter name's reviewers were scoped to the longer one's paths.
    const units = [
      { name: 'AuthMiddleware', summary: 'the guards', paths: ['auth'] },
      { name: 'core-utils', summary: 'the helpers', paths: ['utils'] },
      { name: 'core', summary: 'the protocol', paths: ['core'] },
    ];
    const issues = [
      issue({ file: 'auth/guard.py' }),
      issue({ file: 'utils/text.py' }),
      issue({ file: 'core/wire.py' }),
    ];
    const run = await runFix({ issues, units, args: { fix: false } });

    expect(reported(run, 'review:auth-middleware:bug')).toEqual(['auth/guard.py']);
    expect(reported(run, 'review:core-utils:bug')).toEqual(['utils/text.py']);
    expect(reported(run, 'review:core:bug')).toEqual(['core/wire.py']);
  });

  it('fails loudly on a slug no unit answers to, rather than reviewing everything', async () => {
    // The distinction the fallback lost: `arch` is the architecture lenses, which really do read the whole repository;
    // anything else is a fixture that can no longer say what a reviewer was given.
    const units = [{ name: 'core', summary: 'the protocol', paths: ['core'] }];
    const scenario = fixScenario({ issues: [issue({ file: 'core/wire.py' })], units });

    expect(() => scenario.agent({ label: 'review:not-a-unit:bug' })).toThrow(/slugged 'not-a-unit'/);
    expect(scenario.agent({ label: 'review:arch:coupling' })).toBeDefined();
  });
});
