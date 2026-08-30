/**
 * Argument handling. Each knob has to tolerate a missing or malformed value without silently reviewing something other
 * than what was asked for — a default that quietly widens the scope or turns `--fix` off is worse than an error.
 */

import { describe, expect, it } from 'vitest';

import { runWorkflow } from '../harness.js';
import { fixScenario, internals, issue, runFix, SCRIPT } from './scenario.js';

describe('args arriving as a JSON string', () => {
  it('is recovered, so the knobs inside it still take effect', async () => {
    // This call site has delivered `args` JSON-encoded rather than as an object. Falling back to defaults would look
    // like a successful run while reviewing the whole repository with `--fix` off.
    const scenario = fixScenario();
    const run = await runWorkflow({
      scriptPath: SCRIPT,
      args: JSON.stringify({ fix: true, validators: 1, reviewers: 1, path: 'src' }),
      agent: scenario.agent,
    });

    // Composed with `runWorkflow` directly, because only it takes a JSON-string `args` — which skips the eager call
    // `runFix` makes. The post-condition `fixScenario` registers would still catch these at teardown, but raising them
    // here names the cause before the assertions below fail on the figures it explains: a per-finding prompt that
    // stopped embedding its subject would leave every fix a dead agent and both of them would still hold.
    scenario.report();

    expect(run.result.fix).toBeDefined();
    const [survey] = run.called('survey');
    expect(survey.prompt).toContain('Survey the subtree `src`');
  });

  it('aborts before the first agent when it is not JSON at all', async () => {
    const run = await runWorkflow({ scriptPath: SCRIPT, args: 'src --fix', agent: () => null });

    expect(run.calls).toHaveLength(0);
    expect(run.result.findings).toEqual([]);
    expect(run.result.gaps.join(' ')).toContain('nothing was reviewed');
    // `reviewedCommit` is on every exit. Omitting it here would leave the wrapper an undefined third state alongside
    // the SHA and the null it is told to read as "fall back to `git rev-parse HEAD`".
    expect(run.result).toHaveProperty('reviewedCommit', null);
  });

  it('aborts when JSON has a trailing comma', async () => {
    const run = await runWorkflow({ scriptPath: SCRIPT, args: '{"fix": true,}', agent: () => null });

    expect(run.calls).toHaveLength(0);
    expect(run.result.findings).toEqual([]);
    expect(run.result.gaps.join(' ')).toContain('nothing was reviewed');
  });

  it('aborts when JSON uses single quotes instead of double quotes', async () => {
    const run = await runWorkflow({ scriptPath: SCRIPT, args: "{'fix': true}", agent: () => null });

    expect(run.calls).toHaveLength(0);
    expect(run.result.findings).toEqual([]);
    expect(run.result.gaps.join(' ')).toContain('nothing was reviewed');
  });

  it('recovers deeply nested JSON objects', async () => {
    const scenario = fixScenario();
    const deepArgs = {
      fix: true,
      validators: 1,
      reviewers: 1,
      path: 'src',
      nested: { level1: { level2: { level3: { level4: 'deep' } } } },
    };
    const run = await runWorkflow({
      scriptPath: SCRIPT,
      args: JSON.stringify(deepArgs),
      agent: scenario.agent,
    });

    expect(run.result.fix).toBeDefined();
    const [survey] = run.called('survey');
    expect(survey.prompt).toContain('Survey the subtree `src`');
  });

  it('recovers JSON with special characters and unicode', async () => {
    const scenario = fixScenario();
    const argsWithSpecialChars = {
      fix: true,
      validators: 1,
      reviewers: 1,
      path: 'src',
      comment: 'Line with "quotes" and \\backslash\nand newline\tand tab 测试',
    };
    const run = await runWorkflow({
      scriptPath: SCRIPT,
      args: JSON.stringify(argsWithSpecialChars),
      agent: scenario.agent,
    });

    expect(run.result.fix).toBeDefined();
    const [survey] = run.called('survey');
    expect(survey.prompt).toContain('Survey the subtree `src`');
  });

  it('recovers JSON with null values and various data types', async () => {
    const scenario = fixScenario();
    const argsWithVariousTypes = {
      fix: true,
      validators: 1,
      reviewers: 1,
      path: 'src',
      nullValue: null,
      boolValue: false,
      numValue: 42,
      arrayValue: [1, 2, 3],
    };
    const run = await runWorkflow({
      scriptPath: SCRIPT,
      args: JSON.stringify(argsWithVariousTypes),
      agent: scenario.agent,
    });

    expect(run.result.fix).toBeDefined();
    const [survey] = run.called('survey');
    expect(survey.prompt).toContain('Survey the subtree `src`');
  });

  it('recovers JSON with extra whitespace', async () => {
    const scenario = fixScenario();
    const argsString = `  {
      "fix": true,
      "validators": 1,
      "reviewers": 1,
      "path": "src"
    }  `;
    const run = await runWorkflow({
      scriptPath: SCRIPT,
      args: argsString,
      agent: scenario.agent,
    });

    expect(run.result.fix).toBeDefined();
    const [survey] = run.called('survey');
    expect(survey.prompt).toContain('Survey the subtree `src`');
  });

  it('aborts when JSON is truncated', async () => {
    const run = await runWorkflow({ scriptPath: SCRIPT, args: '{"fix": true, "path": "sr', agent: () => null });

    expect(run.calls).toHaveLength(0);
    expect(run.result.findings).toEqual([]);
    expect(run.result.gaps.join(' ')).toContain('nothing was reviewed');
  });
});

describe('knobs', () => {
  it('rejects an unknown effort value and aborts before running agents', async () => {
    const run = await runWorkflow({ scriptPath: SCRIPT, args: { effort: 'turbo' }, agent: () => null });

    expect(run.calls).toHaveLength(0);
    expect(run.result.findings).toEqual([]);
    expect(run.result.gaps.join(' ')).toContain('--effort');
    expect(run.result.gaps.join(' ')).toContain('turbo');
  });

  it('accepts known effort values', async () => {
    expect((await internals({ effort: 'low' })).effort).toBe('low');
    expect((await internals({ effort: 'high' })).effort).toBe('high');
  });

  it('caps the high-fan-out agents at xhigh but leaves lower efforts alone', async () => {
    // Many concurrent `max` Opus inferences have been observed to stall, and the Review phase is a barrier, so one hung
    // leaf agent wedges the run.
    expect((await internals({ effort: 'max' })).leafEffort).toBe('xhigh');
    expect((await internals({ effort: 'medium' })).leafEffort).toBe('medium');
  });

  it('accepts zero reviewers without falling back to one', async () => {
    // `--reviewers 0` disables the Review Fix phase, so it needs a non-negative parser rather than a positive one.
    expect((await internals({ reviewers: 0 })).reviewers).toBe(0);
    expect((await internals({ reviewers: 'many' })).reviewers).toBe(1);
    expect((await internals({})).reviewers).toBe(1);
  });

  it('treats a bare --loop as the default round cap and no --loop as a single pass', async () => {
    expect((await internals({ loop: true })).maxRounds).toBe(4);
    expect((await internals({ loop: 7 })).maxRounds).toBe(7);
    expect((await internals({})).maxRounds).toBe(1);
  });

  it('spends three validators only on the high-risk categories under --validators auto', async () => {
    // `auto` is what decides whether a finding is judged by one Opus validator or by a panel of three. Getting it
    // backwards is invisible in a result: the review still returns findings, it just pays three times over for the
    // cheap categories, or accepts a single verdict on a security hole.
    const { validatorCount, HIGH_RISK } = await internals({ validators: 'auto' });

    for (const category of HIGH_RISK) {
      expect(validatorCount({ category })).toBe(3);
    }

    expect(validatorCount({ category: 'code-quality' })).toBe(1);

    // A category no reviewer is expected to report — a model can still invent one — is treated as low risk, not as a
    // crash.
    expect(validatorCount({ category: undefined })).toBe(1);
  });

  it('applies an explicit validator count uniformly, high risk or not', async () => {
    const { validatorCount } = await internals({ validators: 2 });

    expect(validatorCount({ category: 'security' })).toBe(2);
    expect(validatorCount({ category: 'code-quality' })).toBe(2);
  });

  it('falls back to a single validator when the count is unusable', async () => {
    const { validatorCount } = await internals({ validators: 'three' });

    expect(validatorCount({ category: 'bug' })).toBe(1);
  });

  it('reads a non-positive or malformed --loop as a single pass, not the default cap', async () => {
    // `--loop` is the one knob that multiplies the cost of the whole run, so a value that is not a positive integer has
    // to fall back to the conservative single pass rather than escalating to the default 4 rounds.
    for (const loop of [0, -1, 'none', '', false]) {
      expect((await internals({ loop })).maxRounds).toBe(1);
      expect((await internals({ loop })).loopEnabled).toBe(false);
    }

    expect((await internals({ loop: 1 })).loopEnabled).toBe(false);
    expect((await internals({ loop: 2 })).loopEnabled).toBe(true);
  });

  it('sizes the auto partition range to the code in scope', async () => {
    // Told to find 4-8 units in a single file, the partitioner invents conceptual slices — and the Review phase is
    // units x reviewers, so every invented slice costs six more agents re-reading the same file.
    const { autoUnitTarget } = await internals();

    // Every band, asserted at both of its edges: a band that is only sampled in its middle can be widened or deleted
    // without failing anything, which is how a 15-file scope ends up partitioned as if it were the whole repository.
    expect(autoUnitTarget(1)).toBe('exactly 1 unit');
    expect(autoUnitTarget(2)).toBe('the range 1-2');
    expect(autoUnitTarget(5)).toBe('the range 1-2');
    expect(autoUnitTarget(6)).toBe('the range 2-4');
    expect(autoUnitTarget(20)).toBe('the range 2-4');
    expect(autoUnitTarget(21)).toBe('the range 4-8');
    expect(autoUnitTarget(200)).toBe('the range 4-8');

    // 0 means the survey returned no usable count: unknown scope keeps the repository-sized default.
    expect(autoUnitTarget(0)).toBe('the range 4-8');
  });

  it('flows the survey inScopeFileCount through to the partition prompt with auto partitions', async () => {
    // The unit test above exercises `autoUnitTarget` in isolation, but if the survey's `inScopeFileCount` field stopped
    // being used for this purpose, that test would still pass. Verify the end-to-end data flow: survey returns a small
    // count → partitioner is told the scaled-down range, not the repository-sized default.
    const run = await runFix({ survey: { inScopeFileCount: 2 } });
    const [partitionCall] = run.called(/partition/);

    expect(partitionCall.prompt).toContain('the range 1-2');
    expect(partitionCall.prompt).not.toContain('the range 4-8');
  });
});

describe('underPath', () => {
  it('returns true for exact file match', async () => {
    const { underPath } = await internals();

    expect(underPath('src/a.ts', 'src/a.ts')).toBe(true);
    expect(underPath('README.md', 'README.md')).toBe(true);
  });

  it('returns true when file is under the path', async () => {
    const { underPath } = await internals();

    expect(underPath('src/a.ts', 'src')).toBe(true);
    expect(underPath('src/nested/b.ts', 'src')).toBe(true);
    expect(underPath('lib/api/handler.ts', 'lib/api')).toBe(true);
  });

  it('handles trailing slashes correctly', async () => {
    const { underPath } = await internals();

    // Path with trailing slash should work the same as without
    expect(underPath('src/a.ts', 'src/')).toBe(true);
    expect(underPath('src/nested/b.ts', 'src/')).toBe(true);
  });

  it('enforces segment boundaries to prevent prefix false positives', async () => {
    const { underPath } = await internals();

    // `src` should not match `srcgen` or `src-backup` - these are sibling paths, not children
    expect(underPath('srcgen/a.ts', 'src')).toBe(false);
    expect(underPath('src-backup/file.ts', 'src')).toBe(false);
    expect(underPath('lib-utils/helper.ts', 'lib')).toBe(false);
  });

  it('returns false when file is not under the path', async () => {
    const { underPath } = await internals();

    expect(underPath('test/a.ts', 'src')).toBe(false);
    expect(underPath('docs/guide.md', 'src')).toBe(false);
    expect(underPath('a.ts', 'src/nested')).toBe(false);
  });
});

describe('path scope', () => {
  it('scopes the review to several subtrees at once', async () => {
    const { paths, scope, lsFiles } = await internals({ paths: ['src', 'lib'] });

    expect(paths).toEqual(['src', 'lib']);
    expect(scope).toBe('the subtrees `src`, `lib`');
    expect(lsFiles).toBe("git ls-files -- 'src' 'lib'");
  });

  it('escapes an apostrophe in a path rather than only quoting around it', async () => {
    // The pathspec is not merely logged: the survey and partition agents are handed it as the command to run. An
    // apostrophe that closed its own quote would leave the remainder of the path to be read as shell syntax, so a
    // scope like `a'; rm -rf .; '` would reach those agents as a literal instruction to run `rm -rf .`.
    const { lsFiles } = await internals({ paths: ["Bob's stuff", "a'; rm -rf .; '"] });

    expect(lsFiles).toBe("git ls-files -- 'Bob'\\''s stuff' 'a'\\''; rm -rf .; '\\'''");
    expect(lsFiles).not.toContain("'a'; rm");
  });

  it('accepts a lone string and the singular key, so a scope is never dropped on a shape mismatch', async () => {
    // A dropped scope does not fail: it reviews the whole repository while every later phase behaves correctly for
    // that wider scope, so nothing downstream can detect it.
    expect((await internals({ paths: 'src' })).scope).toBe('the subtree `src`');
    expect((await internals({ path: 'src' })).scope).toBe('the subtree `src`');
    expect((await internals({ path: ['src', 'lib'] })).paths).toEqual(['src', 'lib']);
  });

  it('drops blank entries and collapses duplicates', async () => {
    // A duplicate costs nothing in the pathspec but reaches the agents as prose implying two distinct scopes.
    expect((await internals({ paths: ['src', ' ', 'src', ' lib ', null] })).paths).toEqual(['src', 'lib']);
  });

  it('filters out non-string elements from paths array', async () => {
    // Non-string elements like numbers, booleans, and objects must be filtered to avoid downstream errors.
    expect((await internals({ paths: ['src', 42, true, {}, [], undefined, 'lib'] })).paths).toEqual(['src', 'lib']);
  });

  it('reviews the whole repository when no path is given', async () => {
    const { paths, scope, lsFiles } = await internals({});

    expect(paths).toEqual([]);
    expect(scope).toBe('the whole repository');
    expect(lsFiles).toBe('git ls-files');
  });

  it('names every subtree to the architecture lenses, which still read the whole repository', async () => {
    const { architecturalLensPrompt, ARCHITECTURAL_LENSES } = await internals({ paths: ['src', 'lib'] });
    const prompt = architecturalLensPrompt(ARCHITECTURAL_LENSES[0], { languages: ['TypeScript'] }, []);

    expect(prompt).toContain('A path scope is in effect (`src`, `lib`)');
    expect(prompt).toContain('report only defects that involve those subtrees');
  });

  it('passes the scope to agents that need it', async () => {
    const run = await runFix({ args: { paths: ['src', 'lib'] } });
    const [survey] = run.called('survey');

    expect(survey.prompt).toContain('Survey the subtrees `src`, `lib`');
  });
});

describe('partition phase', () => {
  it('aborts when partition returns only exclusions and no usable units', async () => {
    // The partitioner may exclude everything in scope (e.g., all generated files), leaving nothing to review. Rather
    // than silently running zero reviewers, the workflow aborts with a specific message naming the cause.
    const run = await runFix({
      units: [],
      exclusions: [{ path: 'generated/bundle.js', reason: 'generated code' }],
    });

    expect(run.result.findings).toEqual([]);
    expect(run.result.exclusions).toHaveLength(1);
    expect(run.result.gaps).toContain('Partition agent did not return usable units — review aborted.');
    expect(run.called(/^review:/)).toHaveLength(0);
  });
});

describe('survey prompt', () => {
  it('tells the survey agent the scope and lsFiles command for the whole repository', async () => {
    const { surveyPrompt, scope, lsFiles } = await internals({});
    const prompt = surveyPrompt();

    expect(prompt).toContain(`Survey ${scope}`);
    expect(prompt).toContain(`Use \`${lsFiles}\``);
    expect(prompt).toContain('Survey the whole repository');
    expect(prompt).toContain('Use `git ls-files`');
  });

  it('tells the survey agent the scope and lsFiles command for a subtree', async () => {
    const { surveyPrompt, scope, lsFiles } = await internals({ paths: ['src'] });
    const prompt = surveyPrompt();

    expect(prompt).toContain(`Survey ${scope}`);
    expect(prompt).toContain(`Use \`${lsFiles}\``);
    expect(prompt).toContain('Survey the subtree `src`');
    expect(prompt).toContain("Use `git ls-files -- 'src'`");
  });

  it('tells the survey agent the scope and lsFiles command for multiple subtrees', async () => {
    const { surveyPrompt, scope, lsFiles } = await internals({ paths: ['src', 'lib'] });
    const prompt = surveyPrompt();

    expect(prompt).toContain(`Survey ${scope}`);
    expect(prompt).toContain(`Use \`${lsFiles}\``);
    expect(prompt).toContain('Survey the subtrees `src`, `lib`');
    expect(prompt).toContain("Use `git ls-files -- 'src' 'lib'`");
  });

  it('instructs the survey agent to capture and report the reviewed commit SHA', async () => {
    const { surveyPrompt } = await internals({});
    const prompt = surveyPrompt();

    expect(prompt).toContain('git rev-parse HEAD');
    expect(prompt).toContain('full 40-character output');
    expect(prompt).toContain('as `headSha`');
    expect(prompt).toContain('the commit the rest of this review is defined against');
  });
});

describe('architectural lens prompts', () => {
  it('adds root CLAUDE.md instruction when cohesion-and-duplication lens has a root CLAUDE.md', async () => {
    const { architecturalLensPrompt, ARCHITECTURAL_LENSES } = await internals();
    const cohesionLens = ARCHITECTURAL_LENSES.find((l) => l.key === 'cohesion-and-duplication');
    const prompt = architecturalLensPrompt(cohesionLens, { languages: ['TypeScript'] }, ['CLAUDE.md', 'src/CLAUDE.md']);

    expect(prompt).toContain('Repository-root `CLAUDE.md`: CLAUDE.md');
    expect(prompt).toContain('read it yourself and judge organization against it');
  });

  it('omits root CLAUDE.md instruction when only non-root CLAUDE.md files exist', async () => {
    const { architecturalLensPrompt, ARCHITECTURAL_LENSES } = await internals();
    const cohesionLens = ARCHITECTURAL_LENSES.find((l) => l.key === 'cohesion-and-duplication');
    const prompt = architecturalLensPrompt(cohesionLens, { languages: ['TypeScript'] }, ['src/CLAUDE.md', 'lib/CLAUDE.md']);

    expect(prompt).not.toContain('Repository-root');
    expect(prompt).not.toContain('read it yourself and judge organization against it');
  });

  it('omits root CLAUDE.md instruction for other lenses even when root CLAUDE.md exists', async () => {
    const { architecturalLensPrompt, ARCHITECTURAL_LENSES } = await internals();
    const otherLens = ARCHITECTURAL_LENSES.find((l) => l.key !== 'cohesion-and-duplication');
    const prompt = architecturalLensPrompt(otherLens, { languages: ['TypeScript'] }, ['CLAUDE.md']);

    expect(prompt).not.toContain('Repository-root');
    expect(prompt).not.toContain('read it yourself and judge organization against it');
  });
});

describe('partition scope enforcement', () => {
  it('intersects the paths the partition agent returned with the ones that were asked for', async () => {
    // Two subtrees overlap in the narrower of the pair, and in nothing at all when neither contains the other.
    const { narrowToScope } = await internals({ paths: ['src', 'lib/api'] });

    expect(narrowToScope(['src/a.ts', 'lib/api/b.ts'])).toEqual(['src/a.ts', 'lib/api/b.ts']);
    expect(narrowToScope(['src/a.ts', 'docs/guide.md', 'lib/other.ts'])).toEqual(['src/a.ts']);

    // A prefix is not containment: `src` must not swallow a sibling directory that merely starts with it.
    expect(narrowToScope(['srcgen/a.ts'])).toEqual([]);

    // A unit path that *contains* a requested one is too wide rather than out of scope, so it narrows to what was
    // asked for instead of being dropped, which would lose that subtree's coverage entirely.
    expect(narrowToScope(['lib'])).toEqual(['lib/api']);
  });

  it('leaves the partition alone when the whole repository is in scope', async () => {
    const { narrowToScope } = await internals({});

    expect(narrowToScope(['docs/guide.md', 'src/a.ts'])).toEqual(['docs/guide.md', 'src/a.ts']);
  });

  it('still sanitises the partition when the whole repository is in scope', async () => {
    // A whole-repo review takes no intersection, but `unit.paths` still reaches `underPath` via `fileInUnit` during
    // dedupe, where a non-string entry throws outside any `try` and discards the Review phase that just finished. A
    // padded entry survives that only to match no file at all, mis-scoping the unit's findings.
    const { narrowToScope, fileInUnit } = await internals({});
    const paths = narrowToScope(['src/a.js', null, ' ', ' src/b.js ', 42, 'src/a.js']);

    expect(paths).toEqual(['src/a.js', 'src/b.js']);
    expect(fileInUnit('src/b.js', { paths })).toBe(true);
  });

  it('keeps the per-unit reviewers inside the requested subtrees whatever the partitioner returned', async () => {
    // `unit.paths` is the scope every phase after Partition actually works from — the reviewers' file list, the count
    // the lens gate keys on, and (with `--fix`) what gets edited. Left unchecked, an agent widening past the requested
    // subtrees redefines the review's scope and nothing downstream can tell.
    const run = await runFix({
      args: { paths: ['src'], fix: false },
      units: [
        { name: 'core', summary: 'in scope', paths: ['src/a.ts', 'docs/guide.md'] },
        { name: 'docs', summary: 'out of scope', paths: ['docs'] },
      ],
      issues: [issue({ file: 'src/a.ts' }), issue({ file: 'docs/guide.md' })],
    });

    const corePrompts = run.called(/^review:core:/).map((call) => call.prompt);

    // Asserted non-empty, or "no reviewer was told about `docs/guide.md`" would also hold if no reviewer ran at all.
    expect(corePrompts).not.toHaveLength(0);
    expect(corePrompts.join('\n')).not.toContain('docs/guide.md');
    expect(run.called(/^review:docs:/)).toHaveLength(0);
    expect(run.logged('Narrowed the partition to the subtree `src`').length).toBe(1);

    // And nothing out of scope came back either, which is the half of this the prompts cannot show: the fixture routes
    // its findings by the *narrowed* roster too, so a finding in a path `core` lost is one no reviewer can report. Left
    // routing by what the partition agent returned, `docs/guide.md` would flow on into validation and the guard above
    // would be satisfied by a fixture that had quietly re-widened the scope.
    expect(run.result.findings.map((finding) => finding.file)).toEqual(['src/a.ts']);
  });

  it('aborts rather than review a partition that lies entirely outside the requested subtrees', async () => {
    // Reviewing the wrong scope is the failure this guard exists to prevent, so there is nothing to fall back to.
    const run = await runFix({
      args: { paths: ['src'], fix: false },
      units: [{ name: 'docs', summary: 'out of scope', paths: ['docs'] }],
    });

    expect(run.called(/^review:/)).toHaveLength(0);
    expect(run.result.findings).toEqual([]);
    expect(run.result.gaps.join(' ')).toContain('no path within the subtree `src`');
  });
});

describe('without --fix', () => {
  it('returns a read-only result and runs no fix agents', async () => {
    const run = await runFix({ args: { fix: false } });

    expect(run.result.fix).toBeUndefined();
    expect(run.result.findings).toHaveLength(1);
    expect(run.called(/^fix:/)).toHaveLength(0);
    expect(run.phases).not.toContain('Fix');
    expect(run.phases).not.toContain('Review Fix');
  });
});

describe('with --fix', () => {
  it('enters the fix phases, including the one no `phase()` call names', async () => {
    // The positive half of the assertion above: 'Review Fix' is only ever entered through the fix reviewers' `phase`
    // option, so if that route went unrecorded the negative form would pass for it whether the phase ran or not.
    const run = await runFix();

    expect(run.phases).toContain('Fix');
    expect(run.phases).toContain('Review Fix');
  });
});

describe('round emphasis escalation', () => {
  it('caps rounds beyond the defined list at the deepest emphasis', async () => {
    // `roundEmphasis` uses `Math.min(round ?? 1, ROUND_EMPHASIS.length - 1)` to cap the round index, so rounds beyond the
    // array's length reuse the deepest emphasis text rather than throwing or returning undefined.
    const { roundEmphasis, ROUND_EMPHASIS } = await internals();

    const round4 = roundEmphasis(4);
    const round5 = roundEmphasis(5);
    const round10 = roundEmphasis(10);

    expect(round4).toBeTruthy();
    expect(round4).toContain('final deep pass');
    expect(round5).toBe(round4);
    expect(round10).toBe(round4);
    expect(round10).toBe(ROUND_EMPHASIS[ROUND_EMPHASIS.length - 1]);
  });

  it('leaves round 1 unemphasised, so a single pass still reads as a baseline', async () => {
    // The other half of the same contract, and the half the cap test above cannot see: the list is 1-based, so index 0
    // is unused and round 1 is the baseline. Both leading entries look like padding — delete them and `roundEmphasis(1)`
    // returns the round-2 directive instead, which every reviewer in an ordinary non-`--loop` run would then be given,
    // telling it to look *past* exactly the issues a first read is there to catch.
    const { emphasisBlock, roundEmphasis, ROUND_EMPHASIS } = await internals();

    expect(ROUND_EMPHASIS.slice(0, 2)).toEqual(['', '']);
    expect(roundEmphasis(1)).toBe('');
    expect(emphasisBlock(1)).toBe('');

    // `roundEmphasis` defaults a missing round to 1, so a caller with no round context gets the baseline too.
    expect(emphasisBlock(undefined)).toBe('');

    // And the empties are not the whole list: escalation starts at round 2, which is the first round to carry text.
    expect(roundEmphasis(2)).toContain('follow-up pass');
    expect(emphasisBlock(2)).toBe(`\n\n${roundEmphasis(2)}`);
  });
});

describe('utility functions for parsing user input', () => {
  describe('positiveIntOr', () => {
    it('returns fallback for NaN', async () => {
      expect((await internals({ validators: NaN })).validators).toBe(1);
      expect((await internals({ loop: NaN })).maxRounds).toBe(1);
    });

    it('returns fallback for Infinity and -Infinity', async () => {
      expect((await internals({ validators: Infinity })).validators).toBe(1);
      expect((await internals({ validators: -Infinity })).validators).toBe(1);
      expect((await internals({ loop: Infinity })).maxRounds).toBe(1);
      expect((await internals({ loop: -Infinity })).maxRounds).toBe(1);
    });

    it('accepts very large positive numbers beyond safe integer range', async () => {
      // parseInt handles astronomically large numbers by converting them to strings first, which may lose precision but
      // still produces an integer that passes the positive check.
      const veryLarge = Number.MAX_SAFE_INTEGER * 10;
      expect((await internals({ validators: veryLarge })).validators).toBe(veryLarge);
      expect((await internals({ loop: veryLarge })).maxRounds).toBe(veryLarge);
    });

    it('returns fallback for non-numeric strings', async () => {
      expect((await internals({ validators: 'abc' })).validators).toBe(1);
      expect((await internals({ validators: 'NaN' })).validators).toBe(1);
      expect((await internals({ validators: 'Infinity' })).validators).toBe(1);
      expect((await internals({ loop: 'abc' })).maxRounds).toBe(1);
    });

    it('parses strings with leading numbers then stops at non-numeric characters', async () => {
      // parseInt('12.34.56', 10) returns 12, not the fallback, because it parses successfully up to the decimal point.
      expect((await internals({ validators: '12.34.56' })).validators).toBe(12);
      expect((await internals({ validators: '42abc' })).validators).toBe(42);
      // parseInt('0x10', 10) returns 0 (stops at 'x' in base 10), which is < 1, so fallback is used.
      expect((await internals({ loop: '0x10' })).maxRounds).toBe(1);
    });

    it('returns fallback for zero and negative numbers', async () => {
      expect((await internals({ validators: 0 })).validators).toBe(1);
      expect((await internals({ validators: -5 })).validators).toBe(1);
      expect((await internals({ loop: -1 })).maxRounds).toBe(1);
    });

    it('returns fallback for edge case strings and objects', async () => {
      expect((await internals({ validators: '' })).validators).toBe(1);
      expect((await internals({ validators: '   ' })).validators).toBe(1);
      expect((await internals({ validators: {} })).validators).toBe(1);
      expect((await internals({ validators: [] })).validators).toBe(1);
      expect((await internals({ validators: null })).validators).toBe(1);
      expect((await internals({ validators: undefined })).validators).toBe(1);
    });
  });

  describe('nonNegativeIntOr', () => {
    it('returns fallback for NaN', async () => {
      expect((await internals({ reviewers: NaN })).reviewers).toBe(1);
    });

    it('returns fallback for Infinity and -Infinity', async () => {
      expect((await internals({ reviewers: Infinity })).reviewers).toBe(1);
      expect((await internals({ reviewers: -Infinity })).reviewers).toBe(1);
    });

    it('accepts zero but rejects negative numbers', async () => {
      expect((await internals({ reviewers: 0 })).reviewers).toBe(0);
      expect((await internals({ reviewers: -1 })).reviewers).toBe(1);
      expect((await internals({ reviewers: -100 })).reviewers).toBe(1);
    });

    it('returns fallback for non-numeric strings', async () => {
      expect((await internals({ reviewers: 'many' })).reviewers).toBe(1);
      expect((await internals({ reviewers: 'abc' })).reviewers).toBe(1);
      expect((await internals({ reviewers: 'NaN' })).reviewers).toBe(1);
      expect((await internals({ reviewers: '' })).reviewers).toBe(1);
    });

    it('accepts very large positive numbers', async () => {
      const veryLarge = Number.MAX_SAFE_INTEGER * 10;
      expect((await internals({ reviewers: veryLarge })).reviewers).toBe(veryLarge);
    });

    it('returns fallback for edge case values', async () => {
      expect((await internals({ reviewers: null })).reviewers).toBe(1);
      expect((await internals({ reviewers: undefined })).reviewers).toBe(1);
      expect((await internals({ reviewers: {} })).reviewers).toBe(1);
      expect((await internals({ reviewers: [] })).reviewers).toBe(1);
    });
  });
});

describe('dedupe resource management', () => {
  it('returns viable rungs when the count is under the ceiling', async () => {
    // Under the ceiling, all rungs in the ladder are viable — the agent can afford the higher effort.
    const { dedupeRungs, DEDUPE_RUNG_CEILING } = await internals();

    // The ceiling for 'high' is 180, so counts well under that should get all rungs.
    const rungs = dedupeRungs(100);

    expect(rungs).toContain('high');
    expect(rungs).toContain('medium');
    expect(rungs.length).toBeGreaterThan(0);
  });

  it('skips rungs whose ceiling is exceeded but still returns the lowest rung', async () => {
    // When the count exceeds a rung's ceiling, that rung is filtered out — but the lowest rung is never dropped, so the
    // dedupe phase still tries something rather than refusing outright.
    const { dedupeRungs, DEDUPE_RUNG_CEILING } = await internals();

    // 200 findings exceeds the 'high' ceiling of 180, so 'high' should be filtered out.
    const rungs = dedupeRungs(200);

    expect(rungs).not.toContain('high');
    expect(rungs).toContain('medium');
    expect(rungs.length).toBeGreaterThan(0);
  });

  it('returns only the lowest rung when all ceilings are exceeded', async () => {
    // When the count exceeds every ceiling in the ladder, the function falls back to the lowest rung rather than
    // returning an empty array — stalling there costs time, but refusing to try costs the merge outright.
    const { dedupeRungs } = await internals();

    // An enormous count that exceeds all realistic ceilings.
    const rungs = dedupeRungs(10000);

    expect(rungs).toEqual(['medium']);
  });

  it('returns a single chunk when the count fits the cap', async () => {
    // Under the cap, no splitting is needed: the whole set goes into one chunk with an empty name (which keeps the plain
    // `dedupe:cross` label it has always had) and all indices in order.
    const { crossChunks, DEDUPE_CHUNK_CAP } = await internals();

    const chunks = crossChunks(50);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].name).toBe('');
    expect(chunks[0].indices).toEqual(Array.from({ length: 50 }, (_, i) => i));
  });

  it('returns multiple pair-covering chunks when the count exceeds the cap', async () => {
    // Over the cap, the set is split into half-cap blocks, and each chunk holds one block paired with another. This
    // guarantees that any two findings share at least one chunk, which is what lets the dedupe converge.
    const { crossChunks, DEDUPE_CHUNK_CAP } = await internals();

    // 200 findings exceeds the cap of 150.
    const chunks = crossChunks(200);

    // More than one chunk, and every pair of blocks should appear.
    expect(chunks.length).toBeGreaterThan(1);

    // Each chunk's name encodes which blocks it holds: '1+2', '1+3', '2+3', etc.
    expect(chunks.some((c) => c.name.includes('+'))).toBe(true);

    // Every chunk should have at most cap-many indices (though most will have exactly cap, since blocks are half-cap).
    for (const chunk of chunks) {
      expect(chunk.indices.length).toBeLessThanOrEqual(DEDUPE_CHUNK_CAP);
    }
  });

  it('handles exactly the cap without splitting', async () => {
    // Right at the cap is still under, so no splitting.
    const { crossChunks, DEDUPE_CHUNK_CAP } = await internals();

    const chunks = crossChunks(DEDUPE_CHUNK_CAP);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].name).toBe('');
    expect(chunks[0].indices).toHaveLength(DEDUPE_CHUNK_CAP);
  });

  it('handles zero or negative counts without throwing', async () => {
    // Edge case: an empty input should not crash, though it should not arise in practice.
    const { crossChunks } = await internals();

    const emptyChunks = crossChunks(0);
    const negativeChunks = crossChunks(-5);

    expect(emptyChunks).toHaveLength(1);
    expect(emptyChunks[0].indices).toEqual([]);
    expect(negativeChunks).toHaveLength(1);
    expect(negativeChunks[0].indices).toEqual([]);
  });

  it('passes through scopes that fit the cap without splitting', async () => {
    // A scope smaller than the cap comes back untouched under its own name, so the ordinary review still runs exactly one
    // agent per unit.
    const { chunkScopes, DEDUPE_CHUNK_CAP } = await internals();

    const scopes = [
      { name: 'unit-a', indices: Array.from({ length: 50 }, (_, i) => i) },
      { name: 'unit-b', indices: Array.from({ length: 30 }, (_, i) => i + 50) },
    ];

    const chunked = chunkScopes(scopes);

    // Two scopes in, two scopes out.
    expect(chunked).toHaveLength(2);
    expect(chunked[0].name).toBe('unit-a');
    expect(chunked[0].indices).toHaveLength(50);
    expect(chunked[1].name).toBe('unit-b');
    expect(chunked[1].indices).toHaveLength(30);
  });

  it('splits over-cap scopes into pair-covering chunks', async () => {
    // A scope bigger than the cap is split into chunks the same way `crossChunks` does, with chunk names joined to the
    // scope name by a colon.
    const { chunkScopes, DEDUPE_CHUNK_CAP } = await internals();

    const scopes = [{ name: 'big-unit', indices: Array.from({ length: 200 }, (_, i) => i) }];

    const chunked = chunkScopes(scopes);

    // More than one chunk out.
    expect(chunked.length).toBeGreaterThan(1);

    // Each chunk's name should start with the scope name and include the chunk suffix.
    for (const chunk of chunked) {
      expect(chunk.name).toContain('big-unit');
      expect(chunk.name).toContain('+');
      expect(chunk.indices.length).toBeLessThanOrEqual(DEDUPE_CHUNK_CAP);
    }
  });

  it('handles a mix of under-cap and over-cap scopes', async () => {
    // Some scopes pass through, others are split — the function operates independently on each.
    const { chunkScopes, DEDUPE_CHUNK_CAP } = await internals();

    const scopes = [
      { name: 'small', indices: Array.from({ length: 20 }, (_, i) => i) },
      { name: 'huge', indices: Array.from({ length: 250 }, (_, i) => i + 20) },
    ];

    const chunked = chunkScopes(scopes);

    // The small scope passes through as one.
    const small = chunked.filter((c) => c.name === 'small');
    expect(small).toHaveLength(1);
    expect(small[0].indices).toHaveLength(20);

    // The huge scope is split into multiple chunks.
    const huge = chunked.filter((c) => c.name.startsWith('huge'));
    expect(huge.length).toBeGreaterThan(1);
  });
});

describe('generated path detection', () => {
  it('filters exclusions by the generated flag', async () => {
    // The partition phase marks generated paths with an explicit boolean flag. Exclusions with `generated: true` must be
    // recognized as generated, regardless of their reason text, so fixers are told to leave them unstaged.
    const run = await runFix({
      exclusions: [
        { path: 'dist', reason: 'build output', generated: true },
        { path: 'docs', reason: 'documentation', generated: false },
      ],
    });

    const logged = run.logged('Fixers told to leave');
    expect(logged.length).toBeGreaterThan(0);
    expect(logged[0]).toContain('1 generated path');
  });

  it('filters exclusions by reason when the generated flag is missing', async () => {
    // An exclusion from a partition cached before the `generated` field existed arrives with no flag at all, so the
    // script falls back to matching the reason against a regex. Several patterns indicate generated or build output.
    const run = await runFix({
      exclusions: [
        { path: 'out', reason: 'generated code' },
        { path: 'bundle.js', reason: 'build output' },
        { path: 'lib', reason: 'compiled from TypeScript' },
        { path: 'vendor', reason: 'vendored dependencies' },
      ],
    });

    const logged = run.logged('Fixers told to leave');
    expect(logged.length).toBeGreaterThan(0);
    expect(logged[0]).toContain('4 generated path');
  });

  it('does not misclassify hand-written exclusions as generated', async () => {
    // Exclusions with `generated: false` and a reason that does not match the regex must not be treated as generated,
    // or fixers would be forbidden from staging legitimate source files.
    const run = await runFix({
      exclusions: [
        { path: 'docs', reason: 'documentation', generated: false },
        { path: 'test/fixtures', reason: 'test data', generated: false },
      ],
    });

    const logged = run.logged('Fixers told to leave');
    expect(logged).toHaveLength(0);
  });

  it('names every detected path to the fixer, since the prose is now the whole of the mechanism', async () => {
    // The log line above only says how many paths were found; what acts on them is the list in the fixer's prompt. It
    // used to be backed up by a refusal gate that read `changedFiles` and downgraded a fix that had staged an artifact,
    // and that gate is gone — it existed to keep the landing sequence's cherry-picks from colliding on a regenerated
    // bundle, and nothing is landed now. So an unheeded instruction costs a reviewable diff rather than a fix, and
    // this assertion is the only thing standing between the fixers and no instruction at all.
    const run = await runFix({
      exclusions: [
        { path: 'dist', reason: 'build output', generated: true },
        { path: 'docs', reason: 'documentation', generated: false },
      ],
    });

    const [fix] = run.called(/^fix:/);
    expect(fix.prompt).toContain('NEVER stage these');
    expect(fix.prompt).toContain('- dist');
    expect(fix.prompt).not.toContain('- docs');
  });

  it('passes a path through verbatim, trailing slash and all, rather than normalizing it', async () => {
    // The partitioner may report a directory either way, and the fixer is a model reading prose: `build/` and `build`
    // both name the same directory to it. Normalizing would only matter to a matcher, and there is no longer one — so
    // the path is quoted as the partitioner wrote it, which is also how it appears in the exclusions the report prints.
    const run = await runFix({ exclusions: [{ path: 'build/', reason: 'build output', generated: true }] });

    const [fix] = run.called(/^fix:/);
    expect(fix.prompt).toContain('- build/');
  });

  it('omits the block entirely when nothing was detected, rather than naming an empty list', async () => {
    // A heading with no paths under it reads as a rule the fixer cannot check itself against, and it is one more thing
    // between the fixer and the numbered procedure it is meant to be following.
    const run = await runFix({ exclusions: [{ path: 'docs', reason: 'documentation', generated: false }] });

    const [fix] = run.called(/^fix:/);
    expect(fix.prompt).not.toContain('NEVER stage these');
  });
});
