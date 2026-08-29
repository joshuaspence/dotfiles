/**
 * What a reviewer is told about findings the run already holds.
 *
 * The list is assembled from `deduped`, which holds reviewer prose exactly as the reviewers returned it — multi-line,
 * unbounded, and describing a site that other phases name their own way. So these tests are mostly about the seams
 * between this list and the rest of the run: a finding has to be recognisable as the same finding the dedupe digest
 * named, and one finding has to stay one line.
 */

import { describe, expect, it } from 'vitest';

import { internals, issue } from './scenario.js';

describe('known findings block', () => {
  it('says nothing at all when the run holds nothing yet', async () => {
    // Round 1 must be byte-identical to a single-pass run, so an empty list cannot contribute a heading.
    const { knownFindingsBlock } = await internals();

    expect(knownFindingsBlock([])).toBe('');
    expect(knownFindingsBlock(undefined)).toBe('');
  });

  it('keeps one finding on one line', async () => {
    // A reviewer description is free prose and routinely contains newlines; left in, one finding would read as several
    // and the bullet list would stop being a list.
    const { knownFindingsBlock } = await internals();

    const block = knownFindingsBlock([issue({ description: 'first line\n\nsecond line' })]);

    expect(block.trim().split('\n')).toHaveLength(2); // the heading, then exactly one bullet
    expect(block).toContain('first line second line');
  });

  it('cites the site the way the dedupe digest does', async () => {
    // Both lists name the same findings to different agents. Formatting the site twice is how they drift apart.
    const { knownFindingsBlock, dedupeDigest } = await internals();

    const withLines = issue({ file: 'core/wire.py', lines: '10-20' });
    const without = issue({ file: 'core/wire.py', lines: '' });

    expect(knownFindingsBlock([withLines])).toContain('core/wire.py:10-20');
    expect(knownFindingsBlock([without])).toContain('core/wire.py —');

    // Not just a plausible format — the same one, so a reviewer reading both sees one site.
    expect(dedupeDigest([withLines])).toContain('core/wire.py:10-20');
    expect(dedupeDigest([without])).toContain('core/wire.py —');
  });
});
