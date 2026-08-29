/**
 * Gap message description truncation. When agents fail to return, gap messages include `.slice(0, 80)` to truncate
 * finding descriptions. These tests verify that truncation handles edge cases correctly:
 * - Descriptions longer than 80 characters are truncated
 * - A surrogate pair straddling the budget is dropped whole, never split into a lone surrogate
 * - Newlines and special Markdown characters are handled safely
 */

import { describe, expect, it } from 'vitest';

import { issue, runFix } from './scenario.js';

describe('gap message description truncation', () => {
  describe('validation gap', () => {
    it('truncates descriptions longer than 80 characters', async () => {
      const longDescription = 'A'.repeat(100) + ' and more text that should be cut off';
      const run = await runFix({
        issues: [issue({ description: longDescription })],
        validate: () => null,
      });

      const gap = run.result.gaps.find((entry) => entry.includes('Validation did not complete'));
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
      const split = await runFix({
        issues: [issue({ description: 'A'.repeat(79) + '😀' })],
        validate: () => null,
      });

      const splitGap = split.result.gaps.find((entry) => entry.includes('Validation did not complete'));
      expect(splitGap).toBeTruthy();
      expect(splitGap.isWellFormed()).toBe(true);
      expect(splitGap).toContain('A'.repeat(79));
      // Neither half of the straddling pair survives on its own.
      expect(splitGap).not.toContain('\uD83D');

      // The converse: a pair sitting entirely inside the budget is kept, so the guard above costs no character it did
      // not have to give up. 76 + two whole emoji is exactly 80 code units; the third emoji is past the budget.
      const fitting = await runFix({
        issues: [issue({ description: 'A'.repeat(76) + '😀😀😀' })],
        validate: () => null,
      });

      const fittingGap = fitting.result.gaps.find((entry) => entry.includes('Validation did not complete'));
      expect(fittingGap).toBeTruthy();
      expect(fittingGap.isWellFormed()).toBe(true);
      expect(fittingGap).toContain('A'.repeat(76) + '😀😀');
      expect(fittingGap).not.toContain('😀😀😀');
    });

    it('handles descriptions with newlines', async () => {
      const description = 'First line\nSecond line\nThird line with more text to ensure we exceed 80 characters total';
      const run = await runFix({
        issues: [issue({ description })],
        validate: () => null,
      });

      const gap = run.result.gaps.find((entry) => entry.includes('Validation did not complete'));
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
      const run = await runFix({
        issues: [issue({ description })],
        validate: () => null,
      });

      const gap = run.result.gaps.find((entry) => entry.includes('Validation did not complete'));
      expect(gap).toBeTruthy();
      // Should preserve special characters within the 80-character window.
      expect(gap).toContain('backticks');
    });
  });

  describe('fix review gap', () => {
    it('truncates descriptions longer than 80 characters', async () => {
      const longDescription = 'B'.repeat(100) + ' additional content that exceeds the limit';
      const run = await runFix({
        issues: [issue({ description: longDescription })],
        reviewFix: () => null,
      });

      const gap = run.result.gaps.find((entry) => entry.includes('Fix review did not complete'));
      expect(gap).toBeTruthy();
      expect(gap).toContain('B'.repeat(80));
      expect(gap).not.toContain('additional content that exceeds the limit');
    });

    it('truncates before a surrogate pair rather than splitting it', async () => {
      const description = 'B'.repeat(79) + '🔧';
      const run = await runFix({
        issues: [issue({ description })],
        reviewFix: () => null,
      });

      const gap = run.result.gaps.find((entry) => entry.includes('Fix review did not complete'));
      expect(gap).toBeTruthy();
      expect(gap.isWellFormed()).toBe(true);
      expect(gap).toContain('B'.repeat(79));
      expect(gap).not.toContain('\uD83D');
    });
  });

  describe('fix agent did not return gap', () => {
    it('truncates descriptions longer than 80 characters', async () => {
      const longDescription = 'C'.repeat(100) + ' extra details that will be trimmed';
      const run = await runFix({
        issues: [issue({ description: longDescription })],
        fix: () => null,
      });

      const gap = run.result.gaps.find((entry) => entry.includes('Fix agent did not return'));
      expect(gap).toBeTruthy();
      expect(gap).toContain('C'.repeat(80));
      expect(gap).not.toContain('extra details that will be trimmed');
    });

    it('truncates before a surrogate pair rather than splitting it', async () => {
      const description = 'C'.repeat(79) + '🐛';
      const run = await runFix({
        issues: [issue({ description })],
        fix: () => null,
      });

      const gap = run.result.gaps.find((entry) => entry.includes('Fix agent did not return'));
      expect(gap).toBeTruthy();
      expect(gap.isWellFormed()).toBe(true);
      expect(gap).toContain('C'.repeat(79));
      expect(gap).not.toContain('\uD83D');
    });
  });

  describe('revision agent did not return gap', () => {
    it('truncates descriptions longer than 80 characters', async () => {
      const longDescription = 'D'.repeat(100) + ' more text after the 80 character mark';
      const run = await runFix({
        issues: [issue({ description: longDescription })],
        // First fix succeeds, review rejects it, then revision agent doesn't return.
        reviewFix: (subject, { attempt }) => ({
          approved: false,
          objection: 'needs revision',
        }),
        fix: (subject, { attempt }) => {
          // Original fix returns normally.
          if (attempt === 0) {
            return {
              status: 'applied',
              sha: 'deadbeef' + '0'.repeat(32),
              branch: 'rrfix/wf_test/0',
              changedFiles: [subject.file],
              reason: 'fixed',
            };
          }
          // Revision agent doesn't return.
          return null;
        },
      });

      const gap = run.result.gaps.find((entry) => entry.includes('Revision agent did not return'));
      expect(gap).toBeTruthy();
      expect(gap).toContain('D'.repeat(80));
      expect(gap).not.toContain('more text after the 80 character mark');
    });
  });

  // Note: there is deliberately no gap for "an applied fix with no commit", so the `!current.sha` branch in
  // `fixAndReview` is unreachable and has no truncation case here. `runFixer` owns that invariant and already downgrades
  // such a result to verify-failed ("fix agent reported `applied` without a usable commit SHA / branch"), so nothing
  // reaches `asOutcome` with status='applied' and no SHA — which the comment on `asOutcome` states outright.
  // review-gate.test.js covers the reachable half ("is reported as verify-failed when it claims to have applied without
  // committing"). Referred to by name rather than by line, because these move.
});
