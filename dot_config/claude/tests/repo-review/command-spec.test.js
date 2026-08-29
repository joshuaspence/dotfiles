/**
 * Command specification validation. The command spec (repo-review.md) documents how arguments should be parsed and
 * provides worked examples. These tests verify that:
 * 1. The examples are internally consistent
 * 2. They follow the parsing rules stated in the spec
 * 3. Critical invariants (like not dropping path arguments) are demonstrated
 */

import { describe, expect, it } from 'vitest';

// The worked examples from lines 136-152 of repo-review.md
const SPEC_EXAMPLES = [
  { invocation: '/repo-review', args: {} },
  { invocation: '/repo-review src --partitions 6', args: { paths: ['src'], partitions: 6 } },
  { invocation: '/repo-review src lib', args: { paths: ['src', 'lib'] } },
  { invocation: '/repo-review --loop', args: { loop: true } },
  { invocation: '/repo-review src --loop 3', args: { paths: ['src'], loop: 3 } },
  { invocation: '/repo-review src lib --loop 3', args: { paths: ['src', 'lib'], loop: 3 } },
  { invocation: '/repo-review --fix', args: { fix: true } },
  { invocation: '/repo-review --fix --reviewers 2', args: { fix: true, reviewers: 2 } },
  { invocation: '/repo-review src/a.js --fix', args: { paths: ['src/a.js'], fix: true } },
  { invocation: '/repo-review src --fix lib', args: { paths: ['src', 'lib'], fix: true } },
  { invocation: '/repo-review src/a.js src/b.js --fix', args: { paths: ['src/a.js', 'src/b.js'], fix: true } },
  { invocation: '/repo-review src/a.js --output report.md', args: { paths: ['src/a.js'] } },
  { invocation: '/repo-review src/a.js --fix --output report.md', args: { paths: ['src/a.js'], fix: true } },
  { invocation: '/repo-review pkg docs --fix --output r.md', args: { paths: ['pkg', 'docs'], fix: true } },
  {
    invocation: '/repo-review pkg --effort xhigh --fix --output r.md',
    args: { paths: ['pkg'], effort: 'xhigh', fix: true },
  },
];

describe('command specification examples', () => {
  describe('path argument invariant', () => {
    it('preserves every path argument across all examples', () => {
      // Lines 43-50 state: "Every token in `$ARGUMENTS` is exactly one of three things: a `--flag`, a value
      // belonging to the `--flag` immediately before it, or a `path`. [...] if a token is not a flag and not a
      // preceding flag's value, it **is** a path — carry it through to `args`, and carry through **every** such
      // token rather than only the first."

      for (const { invocation, args } of SPEC_EXAMPLES) {
        const tokens = invocation.split(/\s+/).slice(1); // Skip '/repo-review'
        const pathTokens = extractPaths(tokens);

        if (pathTokens.length === 0) {
          // No paths given → args should omit the paths key entirely
          expect(args.paths).toBeUndefined();
        } else {
          // Paths given → args.paths must contain exactly those paths, in order
          expect(args.paths).toEqual(pathTokens);
        }
      }
    });

    it('demonstrates paths can appear anywhere, not just at the end', () => {
      // Lines 52-53 state: "Paths are not required to be contiguous or to come last"
      const interleaved = SPEC_EXAMPLES.find((ex) => ex.invocation === '/repo-review src --fix lib');

      expect(interleaved).toBeDefined();
      expect(interleaved.args.paths).toEqual(['src', 'lib']);
    });

    it('demonstrates multiple paths can be given', () => {
      // Line 55: "Any number may be given: none (review the whole repository), one, or several."
      const noPaths = SPEC_EXAMPLES.filter((ex) => !ex.args.paths);
      const onePath = SPEC_EXAMPLES.filter((ex) => ex.args.paths?.length === 1);
      const manyPaths = SPEC_EXAMPLES.filter((ex) => (ex.args.paths?.length ?? 0) > 1);

      expect(noPaths.length).toBeGreaterThan(0);
      expect(onePath.length).toBeGreaterThan(0);
      expect(manyPaths.length).toBeGreaterThan(0);
    });
  });

  describe('--output flag handling', () => {
    it('is never passed to the workflow args', () => {
      // Lines 109-112 state: "--output <file> [...] This command handles it; do **not** pass it to the script."
      for (const { invocation, args } of SPEC_EXAMPLES) {
        if (invocation.includes('--output')) {
          expect(args.output).toBeUndefined();
        }
      }
    });

    it('does not consume a path argument', () => {
      // Line 111: "take care that consuming `--output` and its filename does not also consume a `path`"
      const withOutput = SPEC_EXAMPLES.find((ex) => ex.invocation === '/repo-review src/a.js --output report.md');

      expect(withOutput).toBeDefined();
      expect(withOutput.args.paths).toEqual(['src/a.js']);
    });

    it('works with multiple paths and other flags', () => {
      const complex = SPEC_EXAMPLES.find((ex) => ex.invocation === '/repo-review pkg docs --fix --output r.md');

      expect(complex).toBeDefined();
      expect(complex.args.paths).toEqual(['pkg', 'docs']);
      expect(complex.args.fix).toBe(true);
      expect(complex.args.output).toBeUndefined();
    });
  });

  describe('flag combinations', () => {
    it('paths survive every flag combination', () => {
      // Line 134: "note that every `path` survives every flag combination"
      const withPaths = SPEC_EXAMPLES.filter((ex) => ex.args.paths);

      for (const { invocation, args } of withPaths) {
        const tokens = invocation.split(/\s+/).slice(1);
        const expectedPaths = extractPaths(tokens);

        expect(args.paths).toEqual(expectedPaths);
      }
    });

    it('demonstrates --fix can be combined with other flags', () => {
      const fixOnly = SPEC_EXAMPLES.find((ex) => ex.invocation === '/repo-review --fix');
      const fixWithReviewers = SPEC_EXAMPLES.find((ex) => ex.invocation === '/repo-review --fix --reviewers 2');
      const fixWithPath = SPEC_EXAMPLES.find((ex) => ex.invocation === '/repo-review src/a.js --fix');

      expect(fixOnly.args).toEqual({ fix: true });
      expect(fixWithReviewers.args).toEqual({ fix: true, reviewers: 2 });
      expect(fixWithPath.args).toEqual({ paths: ['src/a.js'], fix: true });
    });

    it('demonstrates --loop can be bare or take a value', () => {
      const loopBare = SPEC_EXAMPLES.find((ex) => ex.invocation === '/repo-review --loop');
      const loopWithValue = SPEC_EXAMPLES.find((ex) => ex.invocation === '/repo-review src --loop 3');

      expect(loopBare.args).toEqual({ loop: true });
      expect(loopWithValue.args).toEqual({ paths: ['src'], loop: 3 });
    });
  });

  describe('default omission', () => {
    it('omits keys for flags not supplied by the user', () => {
      // Lines 130-133: "Build it from **only the flags the user actually supplied**: add a key for each flag
      // the user gave, and omit the rest. The script fills in the documented defaults"
      const minimal = SPEC_EXAMPLES.find((ex) => ex.invocation === '/repo-review');

      expect(minimal.args).toEqual({});
      expect(minimal.args.effort).toBeUndefined();
      expect(minimal.args.partitions).toBeUndefined();
      expect(minimal.args.validators).toBeUndefined();
    });

    it('includes only explicitly provided flags', () => {
      const withPartitions = SPEC_EXAMPLES.find((ex) => ex.invocation === '/repo-review src --partitions 6');

      expect(Object.keys(withPartitions.args).sort()).toEqual(['partitions', 'paths']);
    });
  });

  describe('example coverage', () => {
    it('covers paths as files and directories', () => {
      // Line 60: "Each path may name a directory or a single file"
      const files = SPEC_EXAMPLES.filter((ex) => ex.args.paths?.some((p) => p.includes('.')));
      const dirs = SPEC_EXAMPLES.filter((ex) => ex.args.paths?.some((p) => !p.includes('.')));

      expect(files.length).toBeGreaterThan(0);
      expect(dirs.length).toBeGreaterThan(0);
    });

    it('covers all documented flags except --validators and --partitions auto', () => {
      const hasEffort = SPEC_EXAMPLES.some((ex) => ex.args.effort);
      const hasPartitions = SPEC_EXAMPLES.some((ex) => ex.args.partitions);
      const hasLoop = SPEC_EXAMPLES.some((ex) => ex.args.loop);
      const hasFix = SPEC_EXAMPLES.some((ex) => ex.args.fix);
      const hasReviewers = SPEC_EXAMPLES.some((ex) => ex.args.reviewers);

      expect(hasEffort).toBe(true);
      expect(hasPartitions).toBe(true);
      expect(hasLoop).toBe(true);
      expect(hasFix).toBe(true);
      expect(hasReviewers).toBe(true);
    });
  });
});

describe('parsing rule consistency', () => {
  it('array form is used even for single paths', () => {
    // Line 59: "use the array form even for a single path (`["src"]`)"
    const singlePath = SPEC_EXAMPLES.filter((ex) => ex.args.paths?.length === 1);

    for (const { args } of singlePath) {
      expect(Array.isArray(args.paths)).toBe(true);
    }
  });

  it('path order is preserved', () => {
    // Line 58: "an **array of strings** in the order they appeared"
    const multiPath = SPEC_EXAMPLES.find((ex) => ex.invocation === '/repo-review src/a.js src/b.js --fix');

    expect(multiPath.args.paths).toEqual(['src/a.js', 'src/b.js']);
  });

  it('demonstrates loop can be boolean or integer', () => {
    // Lines 83-90 describe --loop taking either no value (bare flag) or an integer
    const loopBoolean = SPEC_EXAMPLES.find((ex) => ex.args.loop === true);
    const loopInteger = SPEC_EXAMPLES.find((ex) => typeof ex.args.loop === 'number');

    expect(loopBoolean).toBeDefined();
    expect(loopInteger).toBeDefined();
  });
});

// Helper: extract path arguments from tokens, following the spec's parsing rules
function extractPaths(tokens) {
  const paths = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    if (token.startsWith('--')) {
      // This is a flag
      const flag = token;

      // Check if this flag takes a value
      if (takesValue(flag)) {
        i += 2; // Skip flag and its value
      } else {
        i += 1; // Skip just the flag
      }
    } else {
      // Not a flag, not a flag value → it's a path
      paths.push(token);
      i += 1;
    }
  }

  return paths;
}

// Flags that take a value (from the spec)
function takesValue(flag) {
  return ['--effort', '--partitions', '--validators', '--loop', '--reviewers', '--output'].includes(flag);
}
