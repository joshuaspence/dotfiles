/**
 * The worked-example table in `repo-review.md`, checked against the parsing rules the same file states in prose.
 *
 * A command file's examples are the part a model actually copies. The prose above them explains how to account for every
 * token; the table shows it being done — so a row that contradicts the prose is worse than no row at all, and nothing
 * executes here to catch it. Hence this suite: it re-derives each row's `paths` from its invocation using only the rules
 * the file states, and fails when the two disagree.
 *
 * The table is **read out of the command file**, not transcribed into this one. A transcription is a second copy that
 * drifts: the previous version of this suite listed eight `--fix` invocations for months after `--fix` moved to
 * `/repo-review-fix`, and every assertion about them passed, because they were only ever assertions about the copy.
 * Which flags take a value is read off the frontmatter's `argument-hint` for the same reason — a hinted `<n>` is what
 * makes the next token a value rather than a path.
 */

import { describe, expect, it } from 'vitest';

import { commandFiles, readCommand } from '../harness.js';

const { frontmatter, body } = readCommand(commandFiles().find((command) => command.name === 'repo-review').path);

// Flags whose hint carries a `<placeholder>`, e.g. `[--rounds <n>]`. Those consume the token after them; a bare
// `[--flag]` does not. There are currently none of the latter, which is why the distinction has to come from the file
// rather than from a list here — a boolean flag added later would silently be read as consuming its neighbour.
const VALUED_FLAGS = new Set(
  [...frontmatter.matchAll(/\[(--[a-z][a-z-]*) </g)].map(([, flag]) => flag),
);

// The `| Invocation | args |` table under "Run the workflow", as `{ invocation, args }` rows. Parsed rather than
// transcribed, so a row added to the file is a row this suite starts checking.
const SPEC_EXAMPLES = (() => {
  const [, table] = /\n( *\| Invocation[\s\S]*?)\n\n/.exec(body) || [];

  const rows = (table || '')
    .split('\n')
    .slice(2) // The header row and the `|---|---|` separator.
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim().replace(/^`|`$/g, '')))
    .filter((cells) => cells.length === 2)
    .map(([invocation, args]) => ({ invocation, args: JSON.parse(args) }));

  // A regex that matched the wrong block, or a table that stopped being a table, would leave this empty and every
  // assertion below vacuously true.
  if (rows.length < 8) {
    throw new Error(`Only ${rows.length} example row(s) parsed out of repo-review.md — the table's shape has changed`);
  }

  return rows;
})();

// Extract the path arguments from an invocation, following the spec's own rules: a token is a flag, the value of the
// flag before it, or a path.
function extractPaths(invocation) {
  const tokens = invocation.split(/\s+/).slice(1); // Skip '/repo-review'.
  const paths = [];

  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].startsWith('--')) {
      if (VALUED_FLAGS.has(tokens[index])) index += 1;
    } else {
      paths.push(tokens[index]);
    }
  }

  return paths;
}

describe('command specification examples', () => {
  describe('path argument invariant', () => {
    it('preserves every path argument across all examples', () => {
      // "if a token is not a flag and not a preceding flag's value, it **is** a path — carry it through to `args`, and
      // carry through **every** such token rather than only the first."
      for (const { invocation, args } of SPEC_EXAMPLES) {
        const pathTokens = extractPaths(invocation);

        if (pathTokens.length === 0) {
          // No paths given → args should omit the paths key entirely.
          expect(args.paths, invocation).toBeUndefined();
        } else {
          // Paths given → args.paths must contain exactly those paths, in order.
          expect(args.paths, invocation).toEqual(pathTokens);
        }
      }
    });

    it('demonstrates paths can appear anywhere, not just at the end', () => {
      // "Paths are not required to be contiguous or to come last". The interleaved row also has to sit either side of a
      // *valued* flag, so that it demonstrates the value not being mistaken for the second path.
      const interleaved = SPEC_EXAMPLES.filter(({ invocation }) => {
        const tokens = invocation.split(/\s+/).slice(1);
        const lastFlag = tokens.reduce((last, token, index) => (token.startsWith('--') ? index : last), -1);

        return lastFlag >= 0 && tokens.slice(lastFlag + 2).some((token) => !token.startsWith('--'));
      });

      expect(interleaved.length).toBeGreaterThan(0);

      for (const { invocation, args } of interleaved) {
        expect(args.paths, invocation).toEqual(extractPaths(invocation));
      }
    });

    it('demonstrates multiple paths can be given', () => {
      // "Any number may be given: none (review the whole repository), one, or several."
      const noPaths = SPEC_EXAMPLES.filter((example) => !example.args.paths);
      const onePath = SPEC_EXAMPLES.filter((example) => example.args.paths?.length === 1);
      const manyPaths = SPEC_EXAMPLES.filter((example) => (example.args.paths?.length ?? 0) > 1);

      expect(noPaths.length).toBeGreaterThan(0);
      expect(onePath.length).toBeGreaterThan(0);
      expect(manyPaths.length).toBeGreaterThan(0);
    });
  });

  describe('the wrapper-handled flags', () => {
    it('leaves no trace of `--output` in the args', () => {
      // "--output <file> [...] This command handles it; do **not** pass it to the script."
      for (const { invocation, args } of SPEC_EXAMPLES.filter((ex) => ex.invocation.includes('--output'))) {
        expect(args.output, invocation).toBeUndefined();
      }
    });

    it('leaves no trace of `--rounds` in the args, however it was combined', () => {
      // `--rounds` bounds the wrapper's own round loop, so it belongs to the wrapper the way `--output` does. Sending it
      // to the script would be harmless but wrong in the way that matters here: the script has no such knob, so the key
      // would be silently ignored and the loop would never actually be bounded.
      for (const { invocation, args } of SPEC_EXAMPLES.filter((ex) => ex.invocation.includes('--rounds'))) {
        expect(args.rounds, invocation).toBeUndefined();
        expect(args.loop, invocation).toBeUndefined();
      }
    });

    it('does not let either of them consume a path', () => {
      // "take care that consuming `--output` and its filename does not also consume a `path`". Both flags take a value,
      // so both can swallow the token after them; the rows that put a path beside one are what demonstrate they do not.
      const withWrapperFlag = SPEC_EXAMPLES.filter(
        (ex) => /--output|--rounds/.test(ex.invocation) && extractPaths(ex.invocation).length > 0,
      );

      expect(withWrapperFlag.length).toBeGreaterThan(0);

      for (const { invocation, args } of withWrapperFlag) {
        expect(args.paths, invocation).toEqual(extractPaths(invocation));
      }
    });
  });

  describe('default omission', () => {
    it('omits keys for flags not supplied by the user', () => {
      // "Build it from **only the flags the user actually supplied**: add a key for each flag the user gave, and omit
      // the rest. The script fills in the documented defaults"
      const minimal = SPEC_EXAMPLES.find((example) => example.invocation === '/repo-review');

      expect(minimal).toBeDefined();
      expect(minimal.args).toEqual({});
    });

    it('includes only explicitly provided flags', () => {
      const withPartitions = SPEC_EXAMPLES.find((example) => example.invocation === '/repo-review src --partitions 6');

      expect(withPartitions).toBeDefined();
      expect(Object.keys(withPartitions.args).sort()).toEqual(['partitions', 'paths']);
    });

    it('never carries a key the script does not read, nor a command-line spelling', () => {
      // The keys the script actually reads off `input`, plus the two the ledger supplies. A row carrying anything else
      // is a silently ignored argument: the script sees `undefined`, applies its default, and reports a run that reads
      // as though the flag had been honoured.
      const READ = [
        'paths',
        'effort',
        'partitions',
        'reviewersPerUnit',
        'validators',
        'round',
        'knownFindings',
      ];

      for (const { invocation, args } of SPEC_EXAMPLES) {
        expect(Object.keys(args).filter((key) => !READ.includes(key)), invocation).toEqual([]);
      }
    });
  });

  describe('example coverage', () => {
    it('covers paths as files and directories', () => {
      // "Each path may name a directory or a single file"
      const files = SPEC_EXAMPLES.filter((ex) => ex.args.paths?.some((path) => path.includes('.')));
      const dirs = SPEC_EXAMPLES.filter((ex) => ex.args.paths?.some((path) => !path.includes('.')));

      expect(files.length).toBeGreaterThan(0);
      expect(dirs.length).toBeGreaterThan(0);
    });

    it('demonstrates every flag the file documents', () => {
      // A flag with no worked example is a flag whose `args` spelling nobody has ever seen written down — which is how
      // `--max-fixes` would arrive as `"max-fixes"`. Read off the hint, so a flag added there needs a row here.
      const hinted = [...frontmatter.matchAll(/\[(--[a-z][a-z-]*)/g)].map(([, flag]) => flag);

      for (const flag of hinted) {
        expect(
          SPEC_EXAMPLES.some((example) => example.invocation.includes(`${flag} `)),
          `no worked example passes ${flag}`,
        ).toBe(true);
      }
    });

    it('covers `auto` as well as an explicit count, for the flags that take it', () => {
      // `auto` and `n` are different code paths in the script — one scales by risk, the other applies uniformly — so a
      // table showing only integers leaves the string form undemonstrated.
      expect(SPEC_EXAMPLES.some((example) => example.args.validators === 'auto')).toBe(true);
      expect(SPEC_EXAMPLES.some((example) => typeof example.args.validators === 'number')).toBe(true);
    });
  });
});

describe('parsing rule consistency', () => {
  it('array form is used even for single paths', () => {
    // "use the array form even for a single path (`["src"]`)"
    const singlePath = SPEC_EXAMPLES.filter((example) => example.args.paths?.length === 1);

    expect(singlePath.length).toBeGreaterThan(0);

    for (const { invocation, args } of singlePath) {
      expect(Array.isArray(args.paths), invocation).toBe(true);
    }
  });

  it('path order is preserved', () => {
    // "an **array of strings** in the order they appeared". Asserted on a row whose two paths would sort differently
    // from the order they were written in, so a re-sort is visible.
    const multiPath = SPEC_EXAMPLES.filter((example) => (example.args.paths?.length ?? 0) > 1);

    expect(multiPath.length).toBeGreaterThan(0);

    for (const { invocation, args } of multiPath) {
      expect(args.paths, invocation).toEqual(extractPaths(invocation));
    }
  });

  it('lets a path that begins with a digit follow a flag that takes a value', () => {
    // The rule `--rounds` replaced consumed the token after it only when that token began with a digit, which made a
    // directory named `2024` unpassable after a bare `--loop`. A mandatory value fixes that by construction: the token
    // after `--rounds` is its value and the one after that is a path, whatever either looks like.
    const digitPath = SPEC_EXAMPLES.find((example) => example.invocation === '/repo-review 2024 --rounds 3');

    expect(digitPath).toBeDefined();
    expect(digitPath.args.paths).toEqual(['2024']);
  });
});
