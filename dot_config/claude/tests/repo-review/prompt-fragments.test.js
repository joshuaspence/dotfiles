/**
 * Shared prompt fragment utilities used across many agent prompts. These functions appear in survey, partition, review,
 * dedupe, validator, and fix prompts. A defect here (e.g. empty-list handling in bulletList, or a typo in
 * FALSE_POSITIVES) would silently break every prompt that uses it.
 */

import { describe, expect, it } from 'vitest';

import { internals } from './scenario.js';

describe('bulletList', () => {
  it('renders items as markdown bullets', async () => {
    const { bulletList } = await internals();

    expect(bulletList(['foo', 'bar', 'baz'], 'empty')).toBe('- foo\n- bar\n- baz');
  });

  it('returns the empty fallback when the list is empty', async () => {
    const { bulletList } = await internals();

    expect(bulletList([], 'nothing to show')).toBe('nothing to show');
  });

  it('returns the empty fallback when the list is null or undefined', async () => {
    const { bulletList } = await internals();

    expect(bulletList(null, 'nothing')).toBe('nothing');
    expect(bulletList(undefined, 'nothing')).toBe('nothing');
  });

  it('handles single-item lists', async () => {
    const { bulletList } = await internals();

    expect(bulletList(['only-one'], 'empty')).toBe('- only-one');
  });
});

describe('surveyBlock', () => {
  it('formats a survey object as a labeled JSON block', async () => {
    const { surveyBlock } = await internals();
    const survey = { languages: ['TypeScript'], tooling: 'npm' };

    const block = surveyBlock(survey);

    expect(block).toContain('Repository survey');
    expect(block).toContain('"languages"');
    expect(block).toContain('"TypeScript"');
    expect(block).toContain('"tooling"');
    expect(block).toContain('"npm"');
  });

  it('pretty-prints the JSON with indentation', async () => {
    const { surveyBlock } = await internals();
    const survey = { nested: { key: 'value' } };

    const block = surveyBlock(survey);

    // Pretty-printed JSON has newlines and indentation, not compact form.
    expect(block).toContain('{\n  "nested"');
    expect(block).not.toContain('{"nested":{"key":"value"}}');
  });
});

describe('FALSE_POSITIVES', () => {
  it('is a non-empty string constant', async () => {
    const { FALSE_POSITIVES } = await internals();

    expect(typeof FALSE_POSITIVES).toBe('string');
    expect(FALSE_POSITIVES.length).toBeGreaterThan(0);
  });

  it('mentions false positives and what to exclude', async () => {
    const { FALSE_POSITIVES } = await internals();

    expect(FALSE_POSITIVES).toContain('false positive');
    expect(FALSE_POSITIVES).toContain('Do NOT flag');
  });

  it('clarifies that pre-existing is not a reason to dismiss', async () => {
    const { FALSE_POSITIVES } = await internals();

    // A common misreading: "this is pre-existing, so I should not flag it". The constant must explicitly rebut that.
    expect(FALSE_POSITIVES).toContain('pre-existing');
    expect(FALSE_POSITIVES).toContain('NOT a reason to dismiss');
  });
});

describe('REVIEW_RULES', () => {
  it('is a non-empty string constant', async () => {
    const { REVIEW_RULES } = await internals();

    expect(typeof REVIEW_RULES).toBe('string');
    expect(REVIEW_RULES.length).toBeGreaterThan(0);
  });

  it('instructs the reviewer not to build or test', async () => {
    const { REVIEW_RULES } = await internals();

    expect(REVIEW_RULES).toContain('Do not build');
    expect(REVIEW_RULES).toContain('typecheck');
    expect(REVIEW_RULES).toContain('test');
  });

  it('requires every finding to cite a location in the repository', async () => {
    const { REVIEW_RULES } = await internals();

    expect(REVIEW_RULES).toContain('cite a location');
    expect(REVIEW_RULES).toContain('this repository');
  });

  it('prefers git ls-files over find', async () => {
    const { REVIEW_RULES } = await internals();

    expect(REVIEW_RULES).toContain('git ls-files');
    expect(REVIEW_RULES).toContain('find');
  });
});

describe('SEVERITY_RUBRIC', () => {
  it('is a non-empty string constant', async () => {
    const { SEVERITY_RUBRIC } = await internals();

    expect(typeof SEVERITY_RUBRIC).toBe('string');
    expect(SEVERITY_RUBRIC.length).toBeGreaterThan(0);
  });

  it('defines all four severity levels', async () => {
    const { SEVERITY_RUBRIC } = await internals();

    expect(SEVERITY_RUBRIC).toContain('critical');
    expect(SEVERITY_RUBRIC).toContain('high');
    expect(SEVERITY_RUBRIC).toContain('medium');
    expect(SEVERITY_RUBRIC).toContain('low');
  });

  it('describes severity as reflecting impact if left unfixed', async () => {
    const { SEVERITY_RUBRIC } = await internals();

    expect(SEVERITY_RUBRIC).toContain('impact');
    expect(SEVERITY_RUBRIC).toContain('unfixed');
  });

  it('defines critical as security or data loss', async () => {
    const { SEVERITY_RUBRIC } = await internals();

    expect(SEVERITY_RUBRIC).toContain('security');
    expect(SEVERITY_RUBRIC).toContain('data loss');
  });
});
