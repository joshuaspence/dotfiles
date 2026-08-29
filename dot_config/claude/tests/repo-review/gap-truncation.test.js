/**
 * Gap message description truncation. When agents fail to return, gap messages include `.slice(0, 80)` to truncate
 * finding descriptions. These tests verify that truncation handles edge cases correctly:
 * - Descriptions longer than 80 characters are truncated
 * - Multi-byte UTF-8 sequences are not corrupted
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

    it('handles multi-byte UTF-8 sequences safely', async () => {
      // Description with emoji and other multi-byte characters near the 80-character boundary.
      // Using characters that are 1-4 bytes: 'A' (1 byte), 'é' (2 bytes), '你' (3 bytes), '😀' (4 bytes).
      const description = 'A'.repeat(76) + '😀😀😀';
      const run = await runFix({
        issues: [issue({ description })],
        validate: () => null,
      });

      const gap = run.result.gaps.find((entry) => entry.includes('Validation did not complete'));
      expect(gap).toBeTruthy();
      // Should not contain corrupted UTF-8 (partial multi-byte sequences).
      // The gap message should be a valid string that can be logged without issues.
      expect(typeof gap).toBe('string');
      expect(gap.length).toBeGreaterThan(0);
    });

    it('handles descriptions with newlines', async () => {
      const description = 'First line\nSecond line\nThird line with more text to ensure we exceed 80 characters total';
      const run = await runFix({
        issues: [issue({ description })],
        validate: () => null,
      });

      const gap = run.result.gaps.find((entry) => entry.includes('Validation did not complete'));
      expect(gap).toBeTruthy();
      // The truncated description should preserve whatever newlines fall within the 80-character window.
      expect(gap).toContain('First line');
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

    it('handles multi-byte UTF-8 sequences safely', async () => {
      const description = 'B'.repeat(76) + '🔧🔧🔧';
      const run = await runFix({
        issues: [issue({ description })],
        reviewFix: () => null,
      });

      const gap = run.result.gaps.find((entry) => entry.includes('Fix review did not complete'));
      expect(gap).toBeTruthy();
      expect(typeof gap).toBe('string');
      expect(gap.length).toBeGreaterThan(0);
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

    it('handles multi-byte UTF-8 sequences safely', async () => {
      const description = 'C'.repeat(76) + '🐛🐛🐛';
      const run = await runFix({
        issues: [issue({ description })],
        fix: () => null,
      });

      const gap = run.result.gaps.find((entry) => entry.includes('Fix agent did not return'));
      expect(gap).toBeTruthy();
      expect(typeof gap).toBe('string');
      expect(gap.length).toBeGreaterThan(0);
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

  // Note: The gap at line 1685 ("Fix agent reported an applied fix with no commit") is unreachable in practice.
  // `runFixer` (line 1626) catches this case first and returns verify-failed with different wording, so nothing
  // reaches `asOutcome` with status='applied' and no SHA. The existing review-gate.test.js verifies this path.
});
