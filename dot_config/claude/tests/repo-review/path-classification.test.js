/**
 * The script's two path matchers: `namesOneFile`, which distinguishes a file from a directory, and `fileInUnit`, which
 * decides whether a finding's file belongs to a partition unit.
 *
 * The `namesOneFile` function identifies
 * single-file paths by checking for a letter-initial extension, which determines whether a unit path should be counted as
 * a file (for the architecture lens gate). A defect here could cause the gate to misfire: classifying a directory as a
 * file would artificially inflate the file count, while failing to recognize a valid file extension could skip the lens
 * review on a large repository.
 */

import { describe, expect, it } from 'vitest';

import { internals } from './scenario.js';

describe('namesOneFile', () => {
  it('recognizes files with common letter-initial extensions', async () => {
    const { namesOneFile } = await internals();

    expect(namesOneFile('core/wire.py')).toBe(true);
    expect(namesOneFile('src/index.js')).toBe(true);
    expect(namesOneFile('lib/parser.ts')).toBe(true);
    expect(namesOneFile('components/Button.tsx')).toBe(true);
    expect(namesOneFile('styles.css')).toBe(true);
    expect(namesOneFile('README.md')).toBe(true);
    expect(namesOneFile('package.json')).toBe(true);
  });

  it('recognizes files with multi-character extensions', async () => {
    const { namesOneFile } = await internals();

    expect(namesOneFile('test.spec.js')).toBe(true);
    expect(namesOneFile('component.test.tsx')).toBe(true);
    expect(namesOneFile('archive.tar.gz')).toBe(true);
  });

  it('classifies bare directory names as non-files', async () => {
    const { namesOneFile } = await internals();

    expect(namesOneFile('src')).toBe(false);
    expect(namesOneFile('test')).toBe(false);
    expect(namesOneFile('lib')).toBe(false);
    expect(namesOneFile('core')).toBe(false);
  });

  it('classifies trailing-slash paths as non-files', async () => {
    const { namesOneFile } = await internals();

    expect(namesOneFile('src/')).toBe(false);
    expect(namesOneFile('test/')).toBe(false);
    expect(namesOneFile('api/')).toBe(false);
    expect(namesOneFile('core/wire/')).toBe(false);
  });

  it('classifies version-like paths as non-files', async () => {
    const { namesOneFile } = await internals();

    // Paths like `pkg/v1.2` have a dot but the segment after it starts with a digit, not a letter.
    expect(namesOneFile('pkg/v1.2')).toBe(false);
    expect(namesOneFile('api/v2.0')).toBe(false);
    expect(namesOneFile('lib/v3.14.159')).toBe(false);
  });

  it('classifies extensionless files as non-files (errs safe)', async () => {
    const { namesOneFile } = await internals();

    // Extensionless files like `Makefile` or `Dockerfile` are misclassified as directories, which errs safe for the
    // lens gate: an unknown-sized scope reviews as a repository rather than skipping the repository-level review.
    expect(namesOneFile('Makefile')).toBe(false);
    expect(namesOneFile('Dockerfile')).toBe(false);
    expect(namesOneFile('LICENSE')).toBe(false);
    expect(namesOneFile('CHANGELOG')).toBe(false);
  });

  it('classifies dotfiles without letter-initial extensions as non-files', async () => {
    const { namesOneFile } = await internals();

    // Dotfiles like `.gitignore` have a dot, but it's at the start, not separating a name from an extension.
    expect(namesOneFile('.gitignore')).toBe(false);
    expect(namesOneFile('.eslintrc')).toBe(false);
    expect(namesOneFile('.env')).toBe(false);
  });

  it('recognizes dotfiles with letter-initial extensions', async () => {
    const { namesOneFile } = await internals();

    // Dotfiles can have extensions too: `.eslintrc.js` has both a leading dot and a valid extension.
    expect(namesOneFile('.eslintrc.js')).toBe(true);
    expect(namesOneFile('.prettierrc.json')).toBe(true);
    expect(namesOneFile('.babelrc.ts')).toBe(true);
  });

  it('handles null and undefined inputs', async () => {
    const { namesOneFile } = await internals();

    expect(namesOneFile(null)).toBe(false);
    expect(namesOneFile(undefined)).toBe(false);
    expect(namesOneFile('')).toBe(false);
  });

  it('handles paths with multiple slashes', async () => {
    const { namesOneFile } = await internals();

    expect(namesOneFile('src/core/wire.py')).toBe(true);
    expect(namesOneFile('test/unit/parser.test.js')).toBe(true);
    expect(namesOneFile('a/b/c/d/e/file.txt')).toBe(true);
  });

  it('strips trailing slashes before classification', async () => {
    const { namesOneFile } = await internals();

    // The function strips trailing slashes, so `file.js/` is read as `file.js`.
    expect(namesOneFile('src/index.js/')).toBe(true);
    expect(namesOneFile('lib/parser.ts//')).toBe(true);
  });

  it('requires the extension to start with a letter', async () => {
    const { namesOneFile } = await internals();

    // Extensions starting with digits or special characters are not recognized as file extensions.
    expect(namesOneFile('archive.7z')).toBe(false);
    expect(namesOneFile('backup.2024')).toBe(false);
    expect(namesOneFile('file.-old')).toBe(false);
  });

  it('rejects extensions with dots inside them', async () => {
    const { namesOneFile } = await internals();

    // The regex requires `[^./]*` after the initial letter, so `file.a.b` is matched by the last segment only.
    // `file.a.b` has extension `b` (letter-initial, valid), so it's a file.
    expect(namesOneFile('file.a.b')).toBe(true);

    // But something like `dir.a.` (dot at the end) has an empty last segment after the final dot.
    expect(namesOneFile('dir.a.')).toBe(false);
  });

  it('handles edge case of file named after extension pattern', async () => {
    const { namesOneFile } = await internals();

    // A file like `test.T` (single letter extension starting with uppercase) should be recognized.
    expect(namesOneFile('test.T')).toBe(true);
    expect(namesOneFile('file.a')).toBe(true);
    expect(namesOneFile('src/module.Z')).toBe(true);
  });

  it('rejects paths where the last segment looks like a directory with a dot', async () => {
    const { namesOneFile } = await internals();

    // Paths like `1.0` or `.config` where the part after the dot doesn't start with a letter.
    expect(namesOneFile('node_modules/package/1.0')).toBe(false);
    expect(namesOneFile('usr/lib/2.7')).toBe(false);
  });
});

describe('fileInUnit', () => {
  // Tested beside `namesOneFile` because it is the script's other path matcher, and the two share a rule: a unit path
  // is a whole file or a whole directory, never a prefix of a sibling's name. It scopes already-reported findings to a
  // unit when feeding a later round, and it routes findings into the dedupe scopes.
  const fileInUnit = async (file, paths) => (await internals()).fileInUnit(file, { paths });

  it('matches a file listed exactly, or one inside a listed directory', async () => {
    expect(await fileInUnit('src/a.ts', ['src/a.ts'])).toBe(true);
    expect(await fileInUnit('src/deep/a.ts', ['src'])).toBe(true);
    expect(await fileInUnit('src/a.ts', ['src/'])).toBe(true);
  });

  it('does not match a sibling whose name merely starts the same way', async () => {
    expect(await fileInUnit('srcx/a.ts', ['src'])).toBe(false);
    expect(await fileInUnit('src/ab.ts', ['src/a.ts'])).toBe(false);
  });

  it('is false for a finding with no file, and for a unit with no paths', async () => {
    // Repo-wide findings can arrive without a primary file; they must not silently match every unit.
    expect(await fileInUnit('', ['src'])).toBe(false);
    expect(await fileInUnit(undefined, ['src'])).toBe(false);
    expect(await fileInUnit('src/a.ts', undefined)).toBe(false);
  });

  it('correctly filters findings per unit when building dedupe scopes', async () => {
    // The actual usage: `dedupeScopes` scopes findings to units through `fileInUnit`, so each scope holds only the
    // indices of findings whose files belong to that unit. Scopes with fewer than 2 findings are dropped by that
    // function's trailing `scope.indices.length > 1` filter, because dedupe needs at least two findings to compare.
    const { dedupeScopes, DEDUPE_UNCLAIMED_SLUG } = await internals();

    const findings = [
      { file: 'src/a.ts', description: 'first in src' },
      { file: 'src/nested/b.ts', description: 'second nested in src' },
      { file: 'lib/c.ts', description: 'first in lib' },
      { file: 'lib/d.ts', description: 'second in lib' },
      { file: 'docs/readme.md', description: 'first in docs' },
      { file: undefined, description: 'repo-wide finding' },
    ];

    const units = [
      { slug: 'src', paths: ['src'] },
      { slug: 'lib', paths: ['lib'] },
    ];

    const scopes = dedupeScopes(findings, units);

    // The `src` unit should contain findings 0 and 1 (both in src/), and the `lib` unit should contain findings 2 and 3.
    const srcScope = scopes.find((scope) => scope.name === 'src');
    const libScope = scopes.find((scope) => scope.name === 'lib');

    expect(srcScope?.indices).toEqual([0, 1]);
    expect(libScope?.indices).toEqual([2, 3]);

    // Findings 4 and 5 (docs/ and repo-wide) are unclaimed and go to a shared bucket since neither matches any unit.
    const unclaimedScope = scopes.find((scope) => scope.name === DEDUPE_UNCLAIMED_SLUG);
    expect(unclaimedScope?.indices).toEqual([4, 5]);
  });
});
