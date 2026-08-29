/**
 * Direct tests for the path validation and extraction helpers that keep an agent inside its sandbox.
 *
 * `isSafeRepoPath` validates paths in `changedFiles` before they reach `git add -- <paths>` in reconciliation. It is
 * critical for security: a malicious path can escape the worktree, write arbitrary files, or inject shell commands.
 * While fix-landing.test.js exercises these guards indirectly through the full pipeline, this suite pins the specific
 * rejection logic for different attack patterns.
 *
 * `sitePaths` extracts every path-shaped run of characters from an `otherSites` entry (which can carry line numbers and
 * free prose), and `containedSites` keeps only the entries whose every extracted path is repo-relative — a bug there
 * would let a fixer write outside its sandbox, so every edge case matters.
 */

import { describe, expect, it } from 'vitest';

import { internals } from './scenario.js';

describe('isSafeRepoPath', () => {
  it('rejects paths with parent directory traversal segments', async () => {
    const { isSafeRepoPath } = await internals();

    expect(isSafeRepoPath('../etc/passwd')).toBe(false);
    expect(isSafeRepoPath('../../.ssh/config')).toBe(false);
    expect(isSafeRepoPath('src/../../.ssh/config')).toBe(false);
    expect(isSafeRepoPath('a/b/../../../evil')).toBe(false);
  });

  it('rejects absolute paths', async () => {
    const { isSafeRepoPath } = await internals();

    expect(isSafeRepoPath('/etc/passwd')).toBe(false);
    expect(isSafeRepoPath('/home/user/.ssh/id_rsa')).toBe(false);
    expect(isSafeRepoPath('/tmp/evil.sh')).toBe(false);
  });

  it('rejects paths with leading dashes that read as options', async () => {
    const { isSafeRepoPath } = await internals();

    expect(isSafeRepoPath('-o/tmp/x')).toBe(false);
    expect(isSafeRepoPath('--help')).toBe(false);
    expect(isSafeRepoPath('-rf')).toBe(false);
  });

  it('rejects paths with shell metacharacters', async () => {
    const { isSafeRepoPath } = await internals();

    expect(isSafeRepoPath('src/a.ts; rm -rf /')).toBe(false);
    expect(isSafeRepoPath('src/a.ts && curl evil.com')).toBe(false);
    expect(isSafeRepoPath('src/a.ts | sh')).toBe(false);
    expect(isSafeRepoPath('$(rm -rf /)')).toBe(false);
    expect(isSafeRepoPath('`curl evil.com`')).toBe(false);
    expect(isSafeRepoPath('src/a.ts > /tmp/output')).toBe(false);
    expect(isSafeRepoPath('src/a.ts < /etc/passwd')).toBe(false);
    expect(isSafeRepoPath('src/a.ts & background')).toBe(false);
    expect(isSafeRepoPath('src/a.ts*')).toBe(false);
    expect(isSafeRepoPath('src/a.ts?')).toBe(false);
    expect(isSafeRepoPath('src/[a-z].ts')).toBe(false);
    expect(isSafeRepoPath('src/{a,b}.ts')).toBe(false);
    expect(isSafeRepoPath('src/a.ts\n')).toBe(false);
    expect(isSafeRepoPath('src/a.ts\t')).toBe(false);
    expect(isSafeRepoPath("src/a.ts'")).toBe(false);
    expect(isSafeRepoPath('src/a.ts"')).toBe(false);
    expect(isSafeRepoPath('src/a.ts\\')).toBe(false);
    expect(isSafeRepoPath('src/a.ts $VAR')).toBe(false);
  });

  it('accepts ordinary repo-relative paths', async () => {
    const { isSafeRepoPath } = await internals();

    expect(isSafeRepoPath('src/a.ts')).toBe(true);
    expect(isSafeRepoPath('lib/b.js')).toBe(true);
    expect(isSafeRepoPath('dot_config/claude/exact_workflows/repo-review.js')).toBe(true);
    expect(isSafeRepoPath('.github/workflows/ci.yml')).toBe(true);
    expect(isSafeRepoPath('a-b.c_d/E1/.eslintrc.json')).toBe(true);
  });

  it('accepts paths with dots but not parent directory traversal', async () => {
    const { isSafeRepoPath } = await internals();

    // Dots are allowed in filenames, just not as a complete `..` segment
    expect(isSafeRepoPath('src/a..b.ts')).toBe(true);
    expect(isSafeRepoPath('src/..bashrc')).toBe(true);
    expect(isSafeRepoPath('.env')).toBe(true);
    expect(isSafeRepoPath('...dots')).toBe(true);
  });

  it('accepts paths with underscores, dots, and hyphens', async () => {
    const { isSafeRepoPath } = await internals();

    expect(isSafeRepoPath('some_file.test.js')).toBe(true);
    expect(isSafeRepoPath('kebab-case-file.ts')).toBe(true);
    expect(isSafeRepoPath('snake_case_file.py')).toBe(true);
    expect(isSafeRepoPath('file.min.js')).toBe(true);
  });

  it('rejects non-string values', async () => {
    const { isSafeRepoPath } = await internals();

    expect(isSafeRepoPath(undefined)).toBe(false);
    expect(isSafeRepoPath(null)).toBe(false);
    expect(isSafeRepoPath(123)).toBe(false);
    expect(isSafeRepoPath(true)).toBe(false);
    expect(isSafeRepoPath({})).toBe(false);
    expect(isSafeRepoPath([])).toBe(false);
  });

  it('rejects empty or whitespace-only paths', async () => {
    const { isSafeRepoPath } = await internals();

    expect(isSafeRepoPath('')).toBe(false);
    expect(isSafeRepoPath(' ')).toBe(false);
    expect(isSafeRepoPath('  ')).toBe(false);
    expect(isSafeRepoPath('\t')).toBe(false);
    expect(isSafeRepoPath('\n')).toBe(false);
  });

  it('enforces the character class: must start with alphanumeric, dot, or underscore', async () => {
    const { isSafeRepoPath } = await internals();

    // Valid starting characters
    expect(isSafeRepoPath('a/file.ts')).toBe(true);
    expect(isSafeRepoPath('9/file.ts')).toBe(true);
    expect(isSafeRepoPath('.hidden/file.ts')).toBe(true);
    expect(isSafeRepoPath('_private/file.ts')).toBe(true);

    // Invalid starting characters
    expect(isSafeRepoPath('-file.ts')).toBe(false);
    expect(isSafeRepoPath('/file.ts')).toBe(false);
    expect(isSafeRepoPath('#file.ts')).toBe(false);
  });
});

describe('sitePaths', () => {
  it('extracts a bare path without modification', async () => {
    const { sitePaths } = await internals();

    expect(sitePaths('src/index.ts')).toEqual(['src/index.ts']);
    expect(sitePaths('lib/util.js')).toEqual(['lib/util.js']);
  });

  it('separates a trailing line number from its path', async () => {
    const { sitePaths } = await internals();

    // Single line number.
    expect(sitePaths('src/index.ts:42')).toEqual(['src/index.ts', '42']);
    expect(sitePaths('lib/util.js:1')).toEqual(['lib/util.js', '1']);

    // Line range: `-` is a path character, so the range itself stays one run.
    expect(sitePaths('src/index.ts:10-20')).toEqual(['src/index.ts', '10-20']);
    expect(sitePaths('lib/util.js:5-15')).toEqual(['lib/util.js', '5-15']);
  });

  it('extracts every token, not only the first', async () => {
    const { sitePaths } = await internals();

    // Common format: "file:line (note)" — the note's words are path-shaped runs of their own, and each is held to the
    // containment rule, which is what stops a second path riding in behind an in-tree one.
    expect(sitePaths('src/index.ts:42 (missing null check)')).toEqual([
      'src/index.ts',
      '42',
      'missing',
      'null',
      'check',
    ]);
    expect(sitePaths('src/a.ts:1 (fix /etc/hosts too)')).toEqual(['src/a.ts', '1', 'fix', '/etc/hosts', 'too']);
  });

  it('handles null and undefined gracefully', async () => {
    const { sitePaths } = await internals();

    // Should not crash, should report no paths at all.
    expect(sitePaths(null)).toEqual([]);
    expect(sitePaths(undefined)).toEqual([]);
  });

  it('ignores surrounding whitespace', async () => {
    const { sitePaths } = await internals();

    expect(sitePaths('  src/index.ts  ')).toEqual(['src/index.ts']);
    expect(sitePaths('\t\nlib/util.js\n\t')).toEqual(['lib/util.js']);
  });

  it('returns no paths for empty or whitespace-only input', async () => {
    const { sitePaths } = await internals();

    expect(sitePaths('')).toEqual([]);
    expect(sitePaths('   ')).toEqual([]);
    expect(sitePaths('\t\n')).toEqual([]);
  });

  it('keeps traversal and home-relative runs intact for the containment check to reject', async () => {
    const { sitePaths } = await internals();

    expect(sitePaths('../config.ts:10')).toEqual(['../config.ts', '10']);
    expect(sitePaths('../../.ssh/config:1')).toEqual(['../../.ssh/config', '1']);
    expect(sitePaths('./local.ts:5')).toEqual(['./local.ts', '5']);
    expect(sitePaths('~/.bashrc')).toEqual(['~/.bashrc']);
  });

  it('coerces non-string input to a string first', async () => {
    const { sitePaths } = await internals();

    // Numbers, booleans, etc. should be stringified rather than crashing.
    expect(sitePaths(123)).toEqual(['123']);
    expect(sitePaths(true)).toEqual(['true']);
  });
});

describe('containedSites', () => {
  it('keeps valid repo-relative paths', async () => {
    const { containedSites } = await internals();

    const sites = ['src/index.ts:42', 'lib/util.js:10 (note)', 'README.md'];
    const result = containedSites(sites);

    expect(result).toEqual(['src/index.ts:42', 'lib/util.js:10 (note)', 'README.md']);
  });

  it('rejects paths that try to escape with ..', async () => {
    const { containedSites } = await internals();

    const sites = [
      'src/index.ts:42',
      '../config.ts:10',
      '../../.ssh/config:1',
      'lib/../../../etc/passwd',
      'lib/util.js:10',
    ];
    const result = containedSites(sites);

    // Only the safe paths should survive.
    expect(result).toEqual(['src/index.ts:42', 'lib/util.js:10']);
  });

  it('rejects absolute paths', async () => {
    const { containedSites } = await internals();

    const sites = [
      'src/index.ts:42',
      '/etc/passwd:1',
      '/home/user/.ssh/config',
      'lib/util.js:10',
    ];
    const result = containedSites(sites);

    expect(result).toEqual(['src/index.ts:42', 'lib/util.js:10']);
  });

  it('rejects home-relative paths', async () => {
    const { containedSites } = await internals();

    const sites = [
      'src/index.ts:42',
      '~/.bashrc:10',
      '~/secrets.txt',
      'lib/util.js:10',
    ];
    const result = containedSites(sites);

    expect(result).toEqual(['src/index.ts:42', 'lib/util.js:10']);
  });

  it('handles empty arrays', async () => {
    const { containedSites } = await internals();

    expect(containedSites([])).toEqual([]);
  });

  it('handles non-array input by returning empty array', async () => {
    const { containedSites } = await internals();

    expect(containedSites(null)).toEqual([]);
    expect(containedSites(undefined)).toEqual([]);
    expect(containedSites('not an array')).toEqual([]);
    expect(containedSites(123)).toEqual([]);
  });

  it('handles malformed entries gracefully', async () => {
    const { containedSites } = await internals();

    const sites = [
      'src/index.ts:42',
      null,
      undefined,
      '',
      '   ',
      'lib/util.js:10',
    ];
    const result = containedSites(sites);

    // Malformed entries should be filtered out (empty strings fail `isRepoRelativePath`).
    expect(result).toEqual(['src/index.ts:42', 'lib/util.js:10']);
  });

  it('validates path after line number stripping', async () => {
    const { containedSites } = await internals();

    // These should have their line numbers stripped before validation.
    const sites = [
      '../config.ts:10',
      '/etc/passwd:1',
      'src/valid.ts:42',
    ];
    const result = containedSites(sites);

    // Only the valid path survives after line number stripping and validation.
    expect(result).toEqual(['src/valid.ts:42']);
  });

  it('handles paths with parenthetical notes', async () => {
    const { containedSites } = await internals();

    const sites = [
      'src/index.ts:42 (null check missing)',
      '../escape.ts:10 (also a problem)',
      'lib/util.js:10 (needs refactor)',
    ];
    const result = containedSites(sites);

    // The escape attempt should be filtered out, others kept.
    expect(result).toEqual([
      'src/index.ts:42 (null check missing)',
      'lib/util.js:10 (needs refactor)',
    ]);
  });

  it('rejects paths that start valid but escape in the middle', async () => {
    const { containedSites } = await internals();

    const sites = [
      'src/index.ts',
      'src/../../../etc/passwd',
      'lib/subdir/../../../../../../etc/hosts',
      'lib/util.js',
    ];
    const result = containedSites(sites);

    expect(result).toEqual(['src/index.ts', 'lib/util.js']);
  });

  it('handles edge case: path that is exactly ..', async () => {
    const { containedSites } = await internals();

    const sites = ['..', '../..', 'src/index.ts'];
    const result = containedSites(sites);

    expect(result).toEqual(['src/index.ts']);
  });

  it('handles paths with .. at the end', async () => {
    const { containedSites } = await internals();

    const sites = ['src/..', 'lib/../..', 'valid/path.ts'];
    const result = containedSites(sites);

    expect(result).toEqual(['valid/path.ts']);
  });
});
