import { describe, expect, it } from 'vitest';

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { slice } from '../exact_scripts/claude-changelog-slice.js';

const SCRIPT = new URL('../exact_scripts/claude-changelog-slice.js', import.meta.url).pathname;

// Newest first, as upstream writes it, with a gap where a version was never released.
const CHANGELOG = `# Changelog

## 2.1.311

- Added \`c\`

## 2.1.40

- Added \`b\`

## 2.1.4

- Added \`a\`
`;

const versions = (text) => [...text.matchAll(/^## (\S+)$/gm)].map(([, version]) => version);

describe('slice', () => {
  it('excludes the lower bound and includes the upper', () => {
    expect(versions(slice(CHANGELOG, '2.1.4', '2.1.40'))).toEqual(['2.1.40']);
  });

  it('orders versions numerically rather than as text', () => {
    // As strings `2.1.311` sorts before `2.1.4`, which would drop every entry newer than the baseline.
    expect(versions(slice(CHANGELOG, '2.1.4', '2.1.311'))).toEqual(['2.1.311', '2.1.40']);
  });

  it('takes every newer version when the upper bound is omitted', () => {
    expect(versions(slice(CHANGELOG, '2.1.40'))).toEqual(['2.1.311']);
  });

  it('accepts bounds that are not themselves released versions', () => {
    expect(versions(slice(CHANGELOG, '2.1.5', '2.1.312'))).toEqual(['2.1.311', '2.1.40']);
  });

  it('keeps each entry with its heading', () => {
    expect(slice(CHANGELOG, '2.1.40')).toBe('## 2.1.311\n\n- Added `c`\n');
  });

  it('rejects a bound that is not a version', () => {
    // `claude --version` prints `2.1.311 (Claude Code)`; passing it through unparsed must fail, not match nothing.
    expect(() => slice(CHANGELOG, '2.1.311 (Claude Code)')).toThrow(/not a version/);
  });
});

describe('command line', () => {
  it('prints the slice of the file it is given', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'changelog-')), 'CHANGELOG.md');
    writeFileSync(path, CHANGELOG);

    expect(execFileSync('node', [SCRIPT, path, '2.1.4', '2.1.40'], { encoding: 'utf8' })).toBe(
      '## 2.1.40\n\n- Added `b`\n',
    );
  });
});
