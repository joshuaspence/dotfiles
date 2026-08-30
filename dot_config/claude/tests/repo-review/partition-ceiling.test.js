/**
 * The bound on how many units a review is allowed to be.
 *
 * `units` is the multiplier every phase downstream of Partition is sized by — reviewers are `units × REVIEWERS`, dedupe
 * is a scope per unit — so it is the one number in the script that has to be a ceiling rather than a request. It was
 * documented as one and implemented as prose: `autoUnitTarget` asked the partitioner for 4-8 units and the script then
 * reviewed however many came back. A run on a 143-file repository consumed an entire session limit without producing
 * anything, and an unbounded unit count is why.
 *
 * So these tests are in two halves. The first pins the range itself, which is also the text the partitioner is asked
 * for. The second pins the fold, and asks the question the prose could not be trusted to answer: what happens to the
 * paths in the units that did not fit. They are reviewed, coarsely, and the report says so — dropping them would make a
 * bounded run report a partial review as a whole one, which is the one failure mode worse than the cost.
 */

import { describe, expect, it } from 'vitest';

import { internals, issue, runFix } from './scenario.js';

// Twelve units, one file each, so a ceiling of 8 has four units' worth of surplus to fold and every unit is nameable in
// an assertion. Paths rather than findings: the fold is about the file lists the reviewers are given, and a unit needs no
// finding in it to have been reviewed.
const twelveUnits = Array.from({ length: 12 }, (_, i) => ({
  name: `unit-${String.fromCharCode(97 + i)}`,
  summary: `the ${i}th thing`,
  paths: [`src/${String.fromCharCode(97 + i)}.ts`],
}));

// A repository-sized scope, so the `auto` range is the widest band and the ceiling is 8. Stated rather than derived from
// the findings, because the fold has to be provoked with more units than files-with-findings.
const wholeRepo = { inScopeFileCount: 200 };

describe('the auto unit range', () => {
  it('scales to the code in scope, at both edges of every band', async () => {
    // Told to find 4-8 units in a single file, the partitioner invents conceptual slices — and the Review phase is
    // units × reviewers, so every invented slice costs six more agents re-reading the same file. A band that is only
    // sampled in its middle can be widened or deleted without failing anything, which is how a 15-file scope ends up
    // partitioned as if it were the whole repository.
    const { autoUnitRange } = await internals();

    expect(autoUnitRange(1)).toEqual([1, 1]);
    expect(autoUnitRange(2)).toEqual([1, 2]);
    expect(autoUnitRange(5)).toEqual([1, 2]);
    expect(autoUnitRange(6)).toEqual([2, 4]);
    expect(autoUnitRange(20)).toEqual([2, 4]);
    expect(autoUnitRange(21)).toEqual([4, 8]);
    expect(autoUnitRange(200)).toEqual([4, 8]);

    // 0 means the survey returned no usable count: unknown scope keeps the repository-sized default.
    expect(autoUnitRange(0)).toEqual([4, 8]);
  });

  it('renders each band as the prose the partitioner is asked for', async () => {
    // The prose is derived from the range rather than written beside it, so the number in the prompt and the number
    // enforced on the answer cannot disagree. This asserts the rendering; the range above is the source.
    const { autoUnitTarget } = await internals();

    expect(autoUnitTarget(1)).toBe('exactly 1 unit');
    expect(autoUnitTarget(2)).toBe('the range 1-2');
    expect(autoUnitTarget(6)).toBe('the range 2-4');
    expect(autoUnitTarget(200)).toBe('the range 4-8');
  });

  it('is the ceiling, and an explicit --partitions is its own ceiling', async () => {
    // `--partitions 3` asks for exactly 3, so 3 is the bound: a partitioner that returns more has not been more helpful,
    // it has returned something other than what it was told. Asserted through two `internals()` loads because the
    // ceiling reads the run's `partitions` knob, which is resolved once from `args`.
    expect((await internals()).unitCeiling(200)).toBe(8);
    expect((await internals()).unitCeiling(3)).toBe(2);
    expect((await internals({ partitions: 3 })).unitCeiling(200)).toBe(3);
    expect((await internals({ partitions: 1 })).unitCeiling(200)).toBe(1);
  });

  it('reads the in-scope count from the survey the same way the prompt does', async () => {
    // Both the range asked for and the ceiling enforced key on this one coercion, so it is a named helper rather than an
    // expression written twice. A missing, zero, negative or non-integer count is unknown scope, not a small one —
    // guessing small would silently cap a whole-repository review at one or two units.
    const { inScopeFiles } = await internals();

    expect(inScopeFiles({ inScopeFileCount: 42 })).toBe(42);
    expect(inScopeFiles({ inScopeFileCount: 0 })).toBe(0);
    expect(inScopeFiles({ inScopeFileCount: -3 })).toBe(0);
    expect(inScopeFiles({ inScopeFileCount: 4.5 })).toBe(0);
    expect(inScopeFiles({})).toBe(0);
    expect(inScopeFiles(null)).toBe(0);
  });
});

describe('coalesceToCeiling', () => {
  const unit = (name, ...paths) => ({ name, paths });

  it('leaves a partition at or under the ceiling untouched', async () => {
    const { coalesceToCeiling } = await internals();
    const three = [unit('a', 'src/a.ts'), unit('b', 'src/b.ts'), unit('c', 'src/c.ts')];

    // Returned as-is, identity included: an untouched partition must not be rebuilt, or every unit would silently lose
    // whichever fields the fold does not carry over.
    expect(coalesceToCeiling(three, 4)).toBe(three);
    expect(coalesceToCeiling(three, 3)).toBe(three);
    expect(coalesceToCeiling([], 8)).toEqual([]);
  });

  it('folds the surplus into one bucket, keeping the units under the ceiling intact', async () => {
    const { coalesceToCeiling, COALESCED_UNIT_NAME } = await internals();

    const folded = coalesceToCeiling(
      [unit('a', 'src/a.ts'), unit('b', 'src/b.ts'), unit('c', 'src/c.ts'), unit('d', 'src/d.ts')],
      3,
    );

    // Two survive whole and the last two become one, so the result is exactly at the ceiling.
    expect(folded).toHaveLength(3);
    expect(folded.slice(0, 2).map((u) => u.name)).toEqual(['a', 'b']);
    expect(folded[2]).toEqual({ name: COALESCED_UNIT_NAME, paths: ['src/c.ts', 'src/d.ts'] });
  });

  it('loses no path, however far over the ceiling the partition was', async () => {
    // The property that matters, asserted as a property rather than through one arrangement: what goes in comes out. A
    // fold that dropped the surplus would pass every count assertion above while silently reviewing less than asked.
    const { coalesceToCeiling } = await internals();
    const before = twelveUnits.flatMap((u) => u.paths);

    [1, 2, 4, 8, 11].forEach((ceiling) => {
      const after = coalesceToCeiling(twelveUnits, ceiling).flatMap((u) => u.paths);

      expect(after, `ceiling ${ceiling} lost a path`).toEqual(before);
    });
  });

  it('folds everything into one unit at a ceiling of 1', async () => {
    const { coalesceToCeiling, COALESCED_UNIT_NAME } = await internals();
    const folded = coalesceToCeiling(twelveUnits, 1);

    expect(folded).toHaveLength(1);
    expect(folded[0].name).toBe(COALESCED_UNIT_NAME);
    expect(folded[0].paths).toHaveLength(12);
  });

  it('de-duplicates the paths it merges, since two units may name the same directory', async () => {
    // `narrowToScope` can widen two units onto the same requested subtree, so the surplus is not always disjoint. A
    // repeated path would be handed to the reviewers twice and counted twice by the lens gate.
    const { coalesceToCeiling } = await internals();
    const folded = coalesceToCeiling([unit('a', 'src'), unit('b', 'lib', 'src'), unit('c', 'src')], 1);

    expect(folded[0].paths).toEqual(['src', 'lib']);
  });

  it('does not fold on a ceiling that is not a usable count', async () => {
    // `unitCeiling` returns whatever `--partitions` resolved to, and a knob that arrived unusable must leave the
    // partition alone rather than collapse a whole review into one unit.
    const { coalesceToCeiling } = await internals();

    expect(coalesceToCeiling(twelveUnits, 0)).toBe(twelveUnits);
    expect(coalesceToCeiling(twelveUnits, -1)).toBe(twelveUnits);
    expect(coalesceToCeiling(twelveUnits, 2.5)).toBe(twelveUnits);
    expect(coalesceToCeiling(twelveUnits, undefined)).toBe(twelveUnits);
  });
});

describe('a partition over the ceiling, end to end', () => {
  it('reviews the ceiling’s worth of units and no more', async () => {
    // The assertion the prose could never make: twelve units come back and eight are reviewed. Counted over the reviewer
    // labels, because that is where the cost is — `units × REVIEWERS`, and `--reviewers 1` through `runFix` makes the
    // two numbers the same one.
    const run = await runFix({
      issues: [issue({ file: 'src/a.ts' })],
      units: twelveUnits,
      survey: wholeRepo,
      args: { fix: false },
    });

    // Six reviewers per unit: `bug`, `security`, `claude-md`, `code-quality`, `consistency`, `test-critique`.
    expect(run.called(/^review:(?!arch)/)).toHaveLength(8 * 6);
  });

  it('names the bucket to its own reviewers, rather than borrowing the first surplus unit’s name', async () => {
    const { COALESCED_UNIT_NAME } = await internals();
    const run = await runFix({
      issues: [issue({ file: 'src/a.ts' })],
      units: twelveUnits,
      survey: wholeRepo,
      args: { fix: false },
    });

    // The unit's name is read back from the label's slug, and it is shown to its reviewers as prose above their file
    // list. A bucket that answered to `unit-h` would tell six reviewers they were reading one module when they were
    // handed five.
    const bucket = run.called(/^review:the-remainder:/);

    expect(bucket).toHaveLength(6);
    expect(bucket[0].prompt).toContain(COALESCED_UNIT_NAME);

    // And the units that were folded into it are not reviewed under their own names.
    expect(run.called(/^review:unit-i:/)).toHaveLength(0);
    expect(run.called(/^review:unit-l:/)).toHaveLength(0);
  });

  it('hands the bucket’s reviewers every path that was folded into it', async () => {
    const run = await runFix({
      issues: [issue({ file: 'src/a.ts' })],
      units: twelveUnits,
      survey: wholeRepo,
      args: { fix: false },
    });

    const [bucket] = run.called(/^review:the-remainder:/);

    // Units 8 through 12 — the fifth from last onwards, since seven survive whole and the eighth slot is the bucket.
    ['src/h.ts', 'src/i.ts', 'src/j.ts', 'src/k.ts', 'src/l.ts'].forEach((path) => {
      expect(bucket.prompt, `${path} was folded in but not shown to the bucket's reviewers`).toContain(path);
    });
  });

  it('records a gap, because a coarser review is invisible in the findings it returns', async () => {
    // Every finding is reported the same way whichever unit produced it, so a bucket of five modules read by one set of
    // reviewers returns a shorter list than five units would have and nothing in that list says why. A log line is not
    // enough: the report is what the user reads, and it is about to offer to fix what did come back.
    const run = await runFix({
      issues: [issue({ file: 'src/a.ts' })],
      units: twelveUnits,
      survey: wholeRepo,
      args: { fix: false },
    });

    const gap = run.result.gaps.find((g) => g.includes('over the ceiling'));

    expect(gap).toBeTruthy();
    expect(gap).toContain('returned 12 unit(s)');
    expect(gap).toContain('ceiling of 8');
    expect(gap).toContain('The last 5 were folded');
    expect(gap).toContain('5 path(s)');
    expect(gap).toContain('`--path`');
  });

  it('records no such gap when the partition fits, so the report does not cry wolf', async () => {
    const run = await runFix({
      issues: [issue({ file: 'src/a.ts' })],
      units: twelveUnits.slice(0, 4),
      survey: wholeRepo,
      args: { fix: false },
    });

    expect(run.result.gaps.filter((g) => g.includes('over the ceiling'))).toEqual([]);
    expect(run.called(/^review:(?!arch)/)).toHaveLength(4 * 6);
  });

  it('counts the ceiling against what the scope narrowing left, not what the agent sent', async () => {
    // The two enforcement steps compose in one direction only: narrowing first can bring an over-ceiling partition back
    // under it on its own, and folding first would bucket units that were about to be dropped for being out of scope
    // anyway — spending the bucket on nothing and reporting a gap for it.
    const run = await runFix({
      issues: [issue({ file: 'src/a.ts' })],
      units: twelveUnits,
      survey: wholeRepo,
      args: { fix: false, paths: ['src/a.ts', 'src/b.ts', 'src/c.ts'] },
    });

    expect(run.called(/^review:(?!arch)/)).toHaveLength(3 * 6);
    expect(run.result.gaps.filter((g) => g.includes('over the ceiling'))).toEqual([]);
  });
});
