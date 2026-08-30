/**
 * Argument handling. Each knob has to tolerate a missing or malformed value without silently reviewing something other
 * than what was asked for — a default that quietly widens the scope past the subtree the user named, or spends one
 * validator where three were asked for, is worse than an error, because the run still returns a plausible report.
 */

import { describe, expect, it } from 'vitest';

import { runWorkflow } from '../harness.js';
import { reviewScenario, internals, issue, runReview, SCRIPT, withFingerprints } from './scenario.js';

describe('args arriving as a JSON string', () => {
  // Some call sites deliver `args` JSON-encoded rather than as an object. Falling back to defaults on one of those would
  // look like a perfectly successful run that reviewed the whole repository instead of the subtree it was pointed at.
  //
  // Driven through `runWorkflow` directly rather than `runReview`, because only it will pass a string as `args` at all.
  const jsonRun = async (args) => {
    const scenario = reviewScenario();
    const run = await runWorkflow({ scriptPath: SCRIPT, args, agent: scenario.agent });

    // Raised here as well as from the post-condition `reviewScenario` registers, so a fixture that could not tell what it
    // was asked about names the cause before the assertions below fail on the figures it explains.
    scenario.report();

    return run;
  };

  it.each([
    ['a plain object of knobs', { validators: 1, path: 'src' }],
    ['deeply nested values', { validators: 1, path: 'src', nested: { l1: { l2: { l3: { l4: 'deep' } } } } }],
    ['quotes, backslashes, control characters and non-ASCII text', {
      validators: 1,
      path: 'src',
      comment: 'Line with "quotes" and \\backslash\nand newline\tand tab 测试',
    }],
    ['nulls and mixed types', { validators: 1, path: 'src', n: null, b: false, i: 42, a: [1, 2, 3] }],
  ])('is recovered when it encodes %s', async (_label, args) => {
    const run = await jsonRun(JSON.stringify(args));
    const [survey] = run.called('survey');

    // The scope is the assertion because it is the knob a silent fallback would lose: every other phase then behaves
    // correctly for the wider scope, so nothing downstream can tell it was widened.
    expect(survey.prompt).toContain('Survey the subtree `src`');
    expect(run.result.findings).toHaveLength(1);
  });

  it('is recovered through the whitespace a heredoc or a shell leaves around it', async () => {
    const run = await jsonRun('  {\n      "validators": 1,\n      "path": "src"\n    }  ');
    const [survey] = run.called('survey');

    expect(survey.prompt).toContain('Survey the subtree `src`');
  });

  it.each([
    ['is not JSON at all', 'src --fix'],
    ['has a trailing comma', '{"path": "src",}'],
    ['uses single quotes', "{'path': 'src'}"],
    ['is truncated', '{"path": "sr'],
  ])('aborts before the first agent when it %s', async (_label, args) => {
    // Guessing at a malformed string is the one thing that must not happen: a review of the wrong scope is reported the
    // same way as a review of the right one. So the run ends before any agent is spawned.
    const run = await runWorkflow({ scriptPath: SCRIPT, args, agent: () => null });

    expect(run.calls).toHaveLength(0);
    expect(run.result.findings).toEqual([]);
    expect(run.result.gaps.join(' ')).toContain('nothing was reviewed');

    // `reviewedCommit` is on every exit. Omitting it here would leave the wrapper an undefined third state alongside the
    // SHA and the null it is told to read as "the review never anchored itself".
    expect(run.result).toHaveProperty('reviewedCommit', null);
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

  it('reads the round number off args, defaulting to the baseline pass', async () => {
    expect((await internals({ round: 3 })).round).toBe(3);
    expect((await internals({})).round).toBe(1);
  });

  it('falls back to round 1 on a round number it cannot read', async () => {
    // The round is not a cap and multiplies nothing — it selects an emphasis directive. So an unreadable value costs the
    // run its steering and must not cost it anything else: round 1 is the baseline, whose prompts are the ones a review
    // that never runs a second round sends.
    for (const round of [0, -1, 'two', '', null, true, NaN, Infinity, {}]) {
      expect((await internals({ round })).round, `round: ${String(round)}`).toBe(1);
    }
  });

  it('keeps only object entries from the known findings it is handed back', async () => {
    // `knownFindings` is the one input that made a full round trip through the wrapper: this round returns findings as
    // JSON and the next round is given them again. A `null` or a bare string in that list reaches `issueSite` while the
    // first reviewer prompt is being built, and it throws there — discarding a whole round before an agent runs.
    //
    // The survivor comes back fingerprinted, which is the second half of the same sanitising step: what the wrapper
    // stored is re-derived rather than trusted, so an entry it hand-edited cannot come back unrecognisable to itself.
    const kept = { category: 'bug', file: 'a.ts', description: 'x' };

    expect((await internals({ knownFindings: [null, undefined, 'a', 7, kept] })).knownFindings).toEqual(
      withFingerprints([kept]),
    );
    expect((await internals({ knownFindings: 'not a list' })).knownFindings).toEqual([]);
    expect((await internals({})).knownFindings).toEqual([]);
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
    const run = await runReview({ survey: { inScopeFileCount: 2 } });
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
    const run = await runReview({ args: { paths: ['src', 'lib'] } });
    const [survey] = run.called('survey');

    expect(survey.prompt).toContain('Survey the subtrees `src`, `lib`');
  });
});

describe('partition phase', () => {
  it('aborts when partition returns only exclusions and no usable units', async () => {
    // The partitioner may exclude everything in scope (e.g., all generated files), leaving nothing to review. Rather
    // than silently running zero reviewers, the workflow aborts with a specific message naming the cause.
    const run = await runReview({
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
    const run = await runReview({
      args: { paths: ['src'] },
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
    const run = await runReview({
      args: { paths: ['src'] },
      units: [{ name: 'docs', summary: 'out of scope', paths: ['docs'] }],
    });

    expect(run.called(/^review:/)).toHaveLength(0);
    expect(run.result.findings).toEqual([]);
    expect(run.result.gaps.join(' ')).toContain('no path within the subtree `src`');
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
    // returns the round-2 directive instead, which every reviewer in an ordinary single-round run would then be given,
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

describe('positiveIntOr, the parser behind every count', () => {
  it('returns fallback for NaN', async () => {
    expect((await internals({ validators: NaN })).validators).toBe(1);
    expect((await internals({ round: NaN })).round).toBe(1);
  });

  it('returns fallback for Infinity and -Infinity', async () => {
    expect((await internals({ validators: Infinity })).validators).toBe(1);
    expect((await internals({ validators: -Infinity })).validators).toBe(1);
    expect((await internals({ round: Infinity })).round).toBe(1);
    expect((await internals({ round: -Infinity })).round).toBe(1);
  });

  it('accepts very large positive numbers beyond safe integer range', async () => {
    // parseInt handles astronomically large numbers by converting them to strings first, which may lose precision but
    // still produces an integer that passes the positive check.
    const veryLarge = Number.MAX_SAFE_INTEGER * 10;
    expect((await internals({ validators: veryLarge })).validators).toBe(veryLarge);
    expect((await internals({ round: veryLarge })).round).toBe(veryLarge);
  });

  it('returns fallback for non-numeric strings', async () => {
    expect((await internals({ validators: 'abc' })).validators).toBe(1);
    expect((await internals({ validators: 'NaN' })).validators).toBe(1);
    expect((await internals({ validators: 'Infinity' })).validators).toBe(1);
    expect((await internals({ round: 'abc' })).round).toBe(1);
  });

  it('parses strings with leading numbers then stops at non-numeric characters', async () => {
    // parseInt('12.34.56', 10) returns 12, not the fallback, because it parses successfully up to the decimal point.
    expect((await internals({ validators: '12.34.56' })).validators).toBe(12);
    expect((await internals({ validators: '42abc' })).validators).toBe(42);
    // parseInt('0x10', 10) returns 0 (stops at 'x' in base 10), which is < 1, so fallback is used.
    expect((await internals({ round: '0x10' })).round).toBe(1);
  });

  it('returns fallback for zero and negative numbers', async () => {
    expect((await internals({ validators: 0 })).validators).toBe(1);
    expect((await internals({ validators: -5 })).validators).toBe(1);
    expect((await internals({ round: -1 })).round).toBe(1);
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

  it('never shows any dedupe agent, at either stage, more findings than the cap', async () => {
    // The resource claim the cap is for, asserted over a whole run rather than over one helper: `scopeDedupe` is the only
    // way a dedupe agent is reached, so one mechanism bounds the per-unit scopes, the cross-unit passes and the leftovers
    // scope alike. A unit's size is the partitioner's free choice and the cross pass grows with everything held, so
    // neither is bounded by anything upstream of this. `dedupe.test.js` covers the chunk labels and the pair coverage.
    const { DEDUPE_CHUNK_CAP } = await internals();
    const perUnit = DEDUPE_CHUNK_CAP + 10;
    const run = await runReview({
      dedupe: () => ({ groups: [] }),
      units: [
        { name: 'api', slug: 'api', summary: 'the request surface', paths: ['api'] },
        { name: 'core', slug: 'core', summary: 'the protocol', paths: ['core'] },
      ],
      issues: [
        ...Array.from({ length: perUnit }, (_, i) => issue({ file: `api/f${i}.py` })),
        ...Array.from({ length: perUnit }, (_, i) => issue({ file: `core/f${i}.py` })),
      ],
    });

    const sizes = run.called(/^dedupe/).map((call) => Number(/Findings \((\d+)\)/.exec(call.prompt)[1]));

    expect(sizes.length).toBeGreaterThan(3);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(DEDUPE_CHUNK_CAP);
  });
});
