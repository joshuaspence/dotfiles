/**
 * The two things `/repo-review` and `/repo-review-fix` must agree about, held here because nothing else can hold them.
 *
 * Workflow scripts are function *bodies*, not modules: the `Workflow` tool reads the file and compiles it, so there is
 * no import, no build step, and no way for two of them to share a line of code. Splitting the commands therefore
 * duplicated two definitions, and both failures are silent:
 *
 *   `fingerprint` — the name a finding is keyed by in the ledger *and* in the `Repo-Review-Finding:` trailer a fix
 *     commit carries. Diverge, and a fix commit names a finding the ledger has under another name: the branch stops
 *     being findable from the finding, `git log --all --grep` stops recovering a killed run, and the wrapper counts a
 *     fixed defect as still open. Every test on either side would still pass, because each script is self-consistent.
 *
 *   `HIGH_RISK` — which categories are fixed and reviewed by Opus rather than Sonnet. The review derives it from its
 *     reviewer roster's `highRisk` flags; the fix command cannot, since it carries no roster. Diverge, and the hardest
 *     defects are fixed on the cheap model with nothing anywhere saying so — no error, no gap, just worse fixes.
 *
 * So the copies are compared directly, against the same fixtures, through both scripts' own declarations.
 */

import { describe, expect, it } from 'vitest';

import { internals as fixInternals } from './scenario.js';
import { internals as reviewInternals } from '../repo-review/scenario.js';

const review = await reviewInternals();
const fix = await fixInternals();

// Chosen for the decisions the key-building makes, since a divergence in any one of them is invisible from either side
// alone: the separator between fields, the digit-stripping, the one field that is not lowercased, and the two
// non-ASCII paths through the normalisation.
const CASES = [
  { category: 'bug', file: 'src/a.ts', description: 'off-by-one in the retry loop' },
  { category: 'bug', file: 'src/a.ts', description: 'the retry loop runs 3 times, not 5' },
  { category: 'security', file: 'src/a.ts', description: 'off-by-one in the retry loop' },

  // The separator: with fields joined on a space rather than NUL these two collapse into one key.
  { category: 'bug', file: 'a b', description: 'c' },
  { category: 'bug', file: 'a', description: 'b c' },

  // `file` is the one field not lowercased, and the description is normalised to letters only.
  { category: 'bug', file: 'Core/Wire.py', description: 'parse_frame ignores the length' },
  { category: 'bug', file: 'core/wire.py', description: 'parse frame ignores the length' },
  { category: 'bug', file: 'src/i18n.ts', description: 'la vérification du cadre est absente' },

  // Fields a hand-edited ledger entry can arrive without. Both scripts have to produce a name rather than throw.
  { category: 'bug', file: 'src/a.ts' },
  { description: 'no category and no file' },
  {},
];

describe('fingerprint parity across the two commands', () => {
  it.each(CASES)('names %j identically in both scripts', (issue) => {
    expect(fix.fingerprint(issue)).toBe(review.fingerprint(issue));
  });

  it('builds the same key, not just the same hash', () => {
    // Asserted separately because the hash is where a key difference would be *hidden*: two mixes over two different
    // strings could in principle collide on one fixture, and the key is what the comment in both files describes.
    for (const issue of CASES) {
      expect(fix.fingerprintKey(issue)).toBe(review.fingerprintKey(issue));
    }
  });

  it('stamps the same field, so a finding round-trips between the commands unchanged', () => {
    // The value the review persists is the value the fix command re-derives and tells a fixer to write into its commit
    // trailer. Stamping through both in turn is the actual round trip, and it must be idempotent as well as equal.
    const held = review.withFingerprint(CASES[0]);

    expect(fix.withFingerprint(held)).toEqual(held);
  });
});

describe('risk model parity', () => {
  it('agrees on which categories are handled at the Opus tier', () => {
    expect([...fix.HIGH_RISK].sort()).toEqual([...review.HIGH_RISK].sort());
  });

  it('lists categories the review can actually report', () => {
    // The fix command's copy is a literal, so it can name a category that no longer exists — which is the quiet half of
    // a divergence: the list still agrees in length and the tier is chosen by a `includes` that never matches.
    const categories = ['architecture', ...review.REVIEWERS.map((reviewer) => reviewer.key)];

    for (const category of fix.HIGH_RISK) {
      expect(categories).toContain(category);
    }
  });
});
