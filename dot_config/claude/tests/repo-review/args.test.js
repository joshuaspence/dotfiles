/**
 * Argument handling. Each knob has to tolerate a missing or malformed value without silently reviewing something other
 * than what was asked for — a default that quietly widens the scope or turns `--fix` off is worse than an error.
 */

import { describe, expect, it } from 'vitest';

import { runWorkflow } from '../harness.js';
import { fixScenario, internals, runFix, SCRIPT } from './scenario.js';

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

    expect(run.result.fix).toBeDefined();
    const [survey] = run.called('survey');
    expect(survey.prompt).toContain('Survey the subtree `src`');
  });

  it('aborts before the first agent when it is not JSON at all', async () => {
    const run = await runWorkflow({ scriptPath: SCRIPT, args: 'src --fix', agent: () => null });

    expect(run.calls).toHaveLength(0);
    expect(run.result.findings).toEqual([]);
    expect(run.result.gaps.join(' ')).toContain('nothing was reviewed');
  });
});

describe('knobs', () => {
  it('clamps an unknown effort to the default', async () => {
    expect((await internals({ effort: 'turbo' })).effort).toBe('high');
    expect((await internals({ effort: 'low' })).effort).toBe('low');
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

    expect(autoUnitTarget(1)).toBe('exactly 1 unit');
    expect(autoUnitTarget(4)).toBe('the range 1-2');
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

  it('tells the survey agent the scope and lsFiles command for the whole repository', async () => {
    const { surveyPrompt, scope, lsFiles } = await internals({});
    const prompt = surveyPrompt();

    expect(prompt).toContain(`Survey ${scope}`);
    expect(prompt).toContain(`Use \`${lsFiles}\``);
    expect(prompt).toBe(prompt); // scope is 'the whole repository', lsFiles is 'git ls-files'
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
    });

    const corePrompts = run.called(/^review:core:/).map((call) => call.prompt);

    // Asserted non-empty, or "no reviewer was told about `docs/guide.md`" would also hold if no reviewer ran at all.
    expect(corePrompts).not.toHaveLength(0);
    expect(corePrompts.join('\n')).not.toContain('docs/guide.md');
    expect(run.called(/^review:docs:/)).toHaveLength(0);
    expect(run.logged('Narrowed the partition to the subtree `src`').length).toBeGreaterThan(0);
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
    expect(run.phases).not.toContain('Reconcile');
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
    expect(run.phases).toContain('Reconcile');
  });
});

describe('round emphasis escalation', () => {
  it('caps rounds beyond the defined list at the deepest emphasis', async () => {
    // Line 459 uses `Math.min(round ?? 1, ROUND_EMPHASIS.length - 1)` to cap the round index, so rounds beyond the
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
});
