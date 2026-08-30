/**
 * How a `gaps` entry names the finding it is about.
 *
 * A gap is frequently the *only* surviving trace of its finding: a fixer that never returned produces no outcome, no
 * branch and no row in any table, so this one line is where the user learns something was lost and where to go look. It
 * has to say which file, and it has to stay one line — `gaps` is rendered as a bullet list, and `description`, `file` and
 * `lines` are all reviewer prose that reached the ledger unexamined. A newline in any of them forges an extra bullet.
 *
 * The budget is 80 code units, which is where the interesting case is: `slice` counts UTF-16, so a cut landing between
 * the halves of a surrogate pair keeps a lone leading surrogate — not a character, and rendered U+FFFD by every route out
 * of this process. Each of this command's three failure paths goes through the same `gapFinding`, and they are asserted
 * end-to-end rather than only on the helper, because a call site that interpolated `issue.description` directly would
 * leave the helper's own tests green.
 */

import { describe, expect, it } from 'vitest';

import { appliedFix, internals, issue, runFix } from './scenario.js';

const gapAbout = (run, phrase) => run.result.gaps.find((entry) => entry.includes(phrase));

// The three ways a fix can leave a gap instead of an outcome, each keyed by the phrase its message opens with.
const PATHS = [
  ['the fixer never returned', 'Fix agent did not return', { fix: () => null }],
  ['no reviewer returned', 'Fix review did not complete', { reviewFix: () => null }],
  [
    'the reviser never returned',
    'Revision agent did not return',
    {
      fix: (subject, { idx, attempt }) => (attempt > 0 ? null : appliedFix(subject, { idx, attempt })),
      reviewFix: () => ({ approved: false, objection: 'needs revision' }),
    },
  ],
];

describe('the one line a lost finding is named on', () => {
  it.each(PATHS)('cites the site and cuts the prose at the budget when %s', async (_label, phrase, config) => {
    const { GAP_DESCRIPTION_BUDGET } = await internals({});
    const description = 'A'.repeat(GAP_DESCRIPTION_BUDGET + 20) + ' and the tail that should be cut off';
    const run = await runFix({ ...config, args: { findings: [issue({ description, lines: '10-20' })] } });
    const gap = gapAbout(run, phrase);

    expect(gap).toContain('src/a.ts:10-20');
    expect(gap).toContain('A'.repeat(GAP_DESCRIPTION_BUDGET));
    expect(gap).not.toContain('and the tail that should be cut off');
  });

  it.each(PATHS)('drops a straddling surrogate pair whole when %s', async (_label, phrase, config) => {
    // 79 single-unit characters and one astral character put the 80-code-unit budget between the halves of the pair,
    // which is the only place truncation can corrupt a description.
    const { GAP_DESCRIPTION_BUDGET } = await internals({});
    const description = 'A'.repeat(GAP_DESCRIPTION_BUDGET - 1) + '😀';
    const run = await runFix({ ...config, args: { findings: [issue({ description })] } });
    const gap = gapAbout(run, phrase);

    expect(gap.isWellFormed()).toBe(true);
    expect(gap).toContain('A'.repeat(GAP_DESCRIPTION_BUDGET - 1));
    expect(gap).not.toContain('\uD83D');
  });

  it.each(PATHS)('stays a single bullet when the prose brought its own line breaks and %s', async (_l, phrase, cfg) => {
    // The line break is planted in `lines` as well as in `description`, because flattening only the description leaves
    // the same hole open one field over: `lines` is reviewer prose too, and it is interpolated into the same entry.
    const description = 'First line\nSecond line\nThird line, with enough text after it to run past the budget';
    const run = await runFix({ ...cfg, args: { findings: [issue({ description, lines: '10\n- forged entry' })] } });
    const gap = gapAbout(run, phrase);

    expect(gap).toContain('First line Second line Third line');
    expect(gap).toContain('src/a.ts:10 - forged entry');
    expect(gap).not.toContain('\n');
  });
});

describe('issueDescription and issueSite, the two clamps behind that line', () => {
  it('keeps a pair that fits entirely inside the budget, so the guard costs nothing it need not', async () => {
    // The converse of the surrogate case above. 76 single-unit characters plus two whole emoji is exactly 80 code units,
    // and the third emoji is past the budget — so the pair-dropping guard must not fire on the second one.
    const { issueDescription } = await internals({});

    expect(issueDescription({ description: 'A'.repeat(76) + '😀😀😀' }, 80)).toBe('A'.repeat(76) + '😀😀');
  });

  it('leaves Markdown punctuation inside the window alone, since the line is rendered as prose', async () => {
    const { issueDescription } = await internals({});
    const description = 'Code with `backticks`, **bold**, and > quotes ' + 'x'.repeat(50);

    expect(issueDescription({ description }, 80)).toContain('`backticks`, **bold**, and > quotes');
  });

  it('answers empty for the values a schema cannot rule out, rather than the text `undefined`', async () => {
    const { issueDescription, issueSite } = await internals({});

    expect(issueDescription(undefined, 80)).toBe('');
    expect(issueDescription({}, 80)).toBe('');
    expect(issueSite(undefined)).toBe('');
    expect(issueSite({})).toBe('');

    // No `lines` is a file-level finding, not a `src/a.ts:undefined` one.
    expect(issueSite({ file: 'src/a.ts' })).toBe('src/a.ts');
  });
});
