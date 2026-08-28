/**
 * Unit names reach `/workflows` inside agent labels, and the partition agent writes them as prose.
 *
 * `review:Wire Protocol Layer:code-quality` was observed clipped to about 40 columns, which cost the category — the one
 * part of that label that says which of six reviewers the row is. The runtime does not shorten a label it is handed, so
 * the budget is the script's to spend: these tests hold the slug to a size where the identifying segments survive, and
 * hold it to a shape that cannot break the `kind:unit:category` label grammar the test scenario parses.
 */

import { describe, expect, it } from 'vitest';

import { internals, issue, REVIEWER_KEYS, runFix } from './scenario.js';

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
    expect(unitSlug('AuthenticationMiddleware')).toBe('authentication');
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

describe('labels built from a unit', () => {
  const units = [{ name: 'Wire Protocol Layer', summary: 'framing', paths: ['wire'] }];
  const issues = [issue({ file: 'wire/frame.py' }), issue({ file: 'wire/parse.py' })];

  it('labels both the reviewers and the dedupe scope with the slug', async () => {
    // Both phases have to agree, since they are read as one tree in `/workflows`. Asserting them together is what
    // catches one of them still interpolating `unit.name`.
    const run = await runFix({ issues, units });

    expect(run.called(/^review:/).map((call) => call.label)).toContain('review:wire-protocol:code-quality');
    expect(run.called(/^dedupe/).map((call) => call.label)).toEqual(['dedupe:wire-protocol']);
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
