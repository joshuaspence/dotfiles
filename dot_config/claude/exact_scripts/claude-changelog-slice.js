/**
 * Print the sections of Claude Code's `CHANGELOG.md` released after `from` and up to and including `to`.
 *
 * ```sh
 * node claude-changelog-slice.js <changelog> <from> [<to>]
 * ```
 *
 * `/claude-settings-review` uses it to read only what changed since its last review, bounded by the installed version.
 * Omitting `to` takes every newer release, which is how the review previews what an upgrade would bring.
 */

import { readFileSync } from 'node:fs';

const parse = (version) => {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`${JSON.stringify(version)} is not a version`);
  }

  return version.split('.').map(Number);
};

const compare = (a, b) => a.map((part, i) => part - b[i]).find((difference) => difference !== 0) ?? 0;

export const slice = (changelog, from, to) => {
  const lower = parse(from);
  const upper = to === undefined ? undefined : parse(to);

  return changelog
    .split(/^(?=## )/m)
    .filter((section) => {
      const heading = section.match(/^## (\d+\.\d+\.\d+)\n/);

      if (!heading) {
        return false;
      }

      const version = parse(heading[1]);
      return compare(version, lower) > 0 && (upper === undefined || compare(version, upper) <= 0);
    })
    .map((section) => `${section.trimEnd()}\n`)
    .join('\n');
};

if (import.meta.main) {
  const [path, from, to] = process.argv.slice(2);
  process.stdout.write(slice(readFileSync(path, 'utf8'), from, to));
}
