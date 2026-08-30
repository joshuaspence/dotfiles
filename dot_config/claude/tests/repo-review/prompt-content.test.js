/**
 * Content verification for the two prompts that shape the review itself: the partition and the reviewers.
 *
 * Every other suite here checks that these prompts were *called* with the right arguments. None of them reads the text,
 * and the text is the whole instruction — an agent told nothing about splitting files still returns a well-formed
 * partition, just one where `src/index.ts` is in two units and gets reviewed twice. So these are the sentences some
 * other invariant depends on, not a transcript of the wording.
 *
 * The fixer's and fix reviewer's prompts moved out with the command that sends them, to
 * `tests/repo-review-fix/prompt-content.test.js`.
 */

import { describe, expect, it } from 'vitest';

import { internals } from './scenario.js';

describe('partitionPrompt', () => {
  it('instructs the agent to never split a single file across units', async () => {
    const { partitionPrompt } = await internals();
    const survey = { languages: ['JavaScript'] };

    const prompt = partitionPrompt(survey, 10);

    expect(prompt).toContain('Never split a single file');
    expect(prompt).toContain('each file belongs to exactly one unit');
  });

  it('asks for a machine-readable `generated` flag, not just a reason naming the path as build output', async () => {
    // This flag is the one part of the partition's answer that outlives the review: the wrapper persists it to the
    // ledger and `/repo-review-fix` reads it to name the paths its fix agents must never stage. Prose alone would put a
    // regex over a free-text `reason` between build output and a fixer's `git add`, which is where a wording the regex
    // does not match ends up in a commit.
    const { partitionPrompt } = await internals();
    const survey = { languages: ['JavaScript'] };

    const prompt = partitionPrompt(survey, 10);

    expect(prompt).toContain('`generated`');
    expect(prompt).toContain('tooling produces that path');
    expect(prompt).toContain('forbid its fix agents from staging those paths');
    expect(prompt).toMatch(/it reads the flag, not your `reason` prose/);
  });

  it('instructs use of git ls-files to enumerate paths', async () => {
    const { partitionPrompt } = await internals();
    const survey = { languages: ['JavaScript'] };

    const prompt = partitionPrompt(survey, 10);

    expect(prompt).toContain('git ls-files');
    expect(prompt).toContain('enumerate');
  });

  it('requires kebab-case unit names with a character limit', async () => {
    const { partitionPrompt } = await internals();
    const survey = { languages: ['JavaScript'] };

    const prompt = partitionPrompt(survey, 10);

    expect(prompt).toContain('kebab-case');
    expect(prompt).toContain('characters');
  });
});

describe('reviewerPrompt', () => {
  it('includes the severity rubric', async () => {
    const { reviewerPrompt, REVIEWERS } = await internals();
    const reviewer = REVIEWERS[0];
    const unit = { name: 'core', paths: ['src/index.js'] };
    const survey = { languages: ['JavaScript'] };

    const prompt = reviewerPrompt(reviewer, unit, survey, []);

    expect(prompt).toContain('Severity');
    expect(prompt).toContain('critical');
    expect(prompt).toContain('high');
    expect(prompt).toContain('medium');
    expect(prompt).toContain('low');
  });

  it('includes the review rules', async () => {
    const { reviewerPrompt, REVIEWERS } = await internals();
    const reviewer = REVIEWERS[0];
    const unit = { name: 'core', paths: ['src/index.js'] };
    const survey = { languages: ['JavaScript'] };

    const prompt = reviewerPrompt(reviewer, unit, survey, []);

    expect(prompt).toContain('Do not build');
    expect(prompt).toContain('cite a location');
  });

  it('includes the false positives guidance', async () => {
    const { reviewerPrompt, REVIEWERS } = await internals();
    const reviewer = REVIEWERS[0];
    const unit = { name: 'core', paths: ['src/index.js'] };
    const survey = { languages: ['JavaScript'] };

    const prompt = reviewerPrompt(reviewer, unit, survey, []);

    expect(prompt).toContain('false positive');
    expect(prompt).toContain('Do NOT flag');
  });

  it('lists the files in scope for the unit', async () => {
    const { reviewerPrompt, REVIEWERS } = await internals();
    const reviewer = REVIEWERS[0];
    const unit = { name: 'core', paths: ['src/index.js', 'src/util.js'] };
    const survey = { languages: ['JavaScript'] };

    const prompt = reviewerPrompt(reviewer, unit, survey, []);

    expect(prompt).toContain('Files in scope');
    expect(prompt).toContain('src/index.js');
    expect(prompt).toContain('src/util.js');
  });
});
