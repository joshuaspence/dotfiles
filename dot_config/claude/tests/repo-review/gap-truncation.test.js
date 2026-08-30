/**
 * How a `gaps` entry names the finding it is about.
 *
 * A finding its adjudicators left out of their answer is reported nowhere else — it is in no `findings` list and has no
 * other row — so this one line is where the user learns something was lost and where to go look. It has to cite the site,
 * and it has to stay one line: `gaps` renders as a bullet list, and a reviewer's `description` routinely arrives with
 * newlines in it. That the line is per *finding* while the agent that dropped it is per *unit* is the point: one
 * adjudicator can leave out one verdict of the several it was asked for, so a per-agent gap would not name the loss.
 *
 * The interesting case is the budget itself. `slice` counts UTF-16 code units, so a cut landing between the halves of a
 * surrogate pair keeps a lone leading surrogate — not a character, and rendered U+FFFD by every way out of the process.
 *
 * `/repo-review-fix` has three failure paths of its own through its own copy of these helpers, pinned in
 * `tests/repo-review-fix/gap-truncation.test.js`.
 */

import { describe, expect, it } from 'vitest';

import { issue, runReview } from './scenario.js';

describe('the one line a lost finding is named on', () => {
  it('truncates descriptions longer than 80 characters', async () => {
    const longDescription = 'A'.repeat(100) + ' and more text that should be cut off';
    const run = await runReview({
      issues: [issue({ description: longDescription })],
      validate: () => null,
    });

    const gap = run.result.gaps.find((entry) => entry.includes('Adjudication did not complete'));
    expect(gap).toBeTruthy();
    // The gap should contain the first 80 characters of the description.
    expect(gap).toContain('A'.repeat(80));
    // But not the full description.
    expect(gap).not.toContain('and more text that should be cut off');
  });

  it('truncates before a surrogate pair rather than splitting it', async () => {
    // 79 single-unit characters and one astral character put the 80-code-unit budget between the halves of the pair,
    // which is the only place truncation can corrupt a description. The pair has to be dropped whole: half of it is
    // a lone surrogate, which is not a character and encodes as U+FFFD the moment the gap is written out.
    const split = await runReview({
      issues: [issue({ description: 'A'.repeat(79) + '😀' })],
      validate: () => null,
    });

    const splitGap = split.result.gaps.find((entry) => entry.includes('Adjudication did not complete'));
    expect(splitGap).toBeTruthy();
    expect(splitGap.isWellFormed()).toBe(true);
    expect(splitGap).toContain('A'.repeat(79));
    // Neither half of the straddling pair survives on its own.
    expect(splitGap).not.toContain('\uD83D');

    // The converse: a pair sitting entirely inside the budget is kept, so the guard above costs no character it did
    // not have to give up. 76 + two whole emoji is exactly 80 code units; the third emoji is past the budget.
    const fitting = await runReview({
      issues: [issue({ description: 'A'.repeat(76) + '😀😀😀' })],
      validate: () => null,
    });

    const fittingGap = fitting.result.gaps.find((entry) => entry.includes('Adjudication did not complete'));
    expect(fittingGap).toBeTruthy();
    expect(fittingGap.isWellFormed()).toBe(true);
    expect(fittingGap).toContain('A'.repeat(76) + '😀😀');
    expect(fittingGap).not.toContain('😀😀😀');
  });

  it('handles descriptions with newlines', async () => {
    const description = 'First line\nSecond line\nThird line with more text to ensure we exceed 80 characters total';
    const run = await runReview({
      issues: [issue({ description })],
      validate: () => null,
    });

    const gap = run.result.gaps.find((entry) => entry.includes('Adjudication did not complete'));
    expect(gap).toBeTruthy();
    // `gaps` is rendered as a one-line-per-finding list, so `issueDescription` collapses every run of whitespace to a
    // single space *before* truncating: the newlines are gone rather than preserved, and one finding stays one entry.
    expect(gap).toContain('First line Second line Third line');
    expect(gap).not.toContain('\n');
    // Still truncated at 80 characters of the collapsed text, so the tail is absent.
    expect(gap).not.toContain('80 characters total');
  });

  it('handles descriptions with special Markdown characters', async () => {
    const description = 'Code with `backticks`, **bold**, *italic*, [links](url), and > quotes ' + 'x'.repeat(50);
    const run = await runReview({
      issues: [issue({ description })],
      validate: () => null,
    });

    const gap = run.result.gaps.find((entry) => entry.includes('Adjudication did not complete'));
    expect(gap).toBeTruthy();
    // Should preserve special characters within the 80-character window.
    expect(gap).toContain('backticks');
  });
});
