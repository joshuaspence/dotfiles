/**
 * Content verification for the five core agent prompts (partition, reviewer, fixer, reconcile, fix-review). While
 * orchestration tests verify these prompts are called with the right arguments (via `runFix` scenarios), none read the
 * actual prompt strings to confirm critical instructions are present. For example: does `partitionPrompt` actually tell
 * the agent to never split a file? Does `fixerPrompt` include the git add instruction? Does `reconcilePrompt` include
 * the STAY IN BOUNDS warning? These prompts are the agents' only instructions, so missing text is a silent failure. A
 * prompt content regression test catches prompt drift.
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

  it('requires exclusions to have a generated flag for build output', async () => {
    const { partitionPrompt } = await internals();
    const survey = { languages: ['JavaScript'] };

    const prompt = partitionPrompt(survey, 10);

    expect(prompt).toContain('generated');
    expect(prompt).toContain('tooling produces that path');
    expect(prompt).toContain('forbids the fix agents from staging');
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

describe('fixerPrompt', () => {
  it('instructs the agent to pin to the review head first', async () => {
    const { fixerPrompt } = await internals();
    const issue = { file: 'test.js', description: 'fix this' };
    const survey = { languages: ['JavaScript'] };

    const prompt = fixerPrompt(issue, survey, 'abc123', 'undefined', []);

    expect(prompt).toContain('PIN YOUR BASE');
    expect(prompt).toContain('git rev-parse');
    expect(prompt).toContain('abc123');
  });

  it('instructs the agent to use git add with explicit paths, never git add -A', async () => {
    const { fixerPrompt } = await internals();
    const issue = { file: 'test.js', description: 'fix this' };
    const survey = { languages: ['JavaScript'] };

    const prompt = fixerPrompt(issue, survey, 'abc123', 'undefined', []);

    expect(prompt).toContain('git add -- <paths>');
    expect(prompt).toContain('never `git add -A`');
  });

  it('requires verification with build/test tooling', async () => {
    const { fixerPrompt } = await internals();
    const issue = { file: 'test.js', description: 'fix this' };
    const survey = { languages: ['JavaScript'] };

    const prompt = fixerPrompt(issue, survey, 'abc123', 'undefined', []);

    expect(prompt).toContain('verify in this worktree');
    expect(prompt).toContain('typecheck and run the tests');
  });

  it('requires returning structured result with status, sha, branch, changedFiles', async () => {
    const { fixerPrompt } = await internals();
    const issue = { file: 'test.js', description: 'fix this' };
    const survey = { languages: ['JavaScript'] };

    const prompt = fixerPrompt(issue, survey, 'abc123', 'undefined', []);

    expect(prompt).toContain('status: "applied"');
    expect(prompt).toContain('sha');
    expect(prompt).toContain('branch');
    expect(prompt).toContain('changedFiles');
  });

  it('warns about generated paths when provided', async () => {
    const { fixerPrompt } = await internals();
    const issue = { file: 'test.js', description: 'fix this' };
    const survey = { languages: ['JavaScript'] };
    const generatedPaths = ['dist/bundle.js', 'package-lock.json'];

    const prompt = fixerPrompt(issue, survey, 'abc123', 'undefined', generatedPaths);

    expect(prompt).toContain('dist/bundle.js');
    expect(prompt).toContain('package-lock.json');
    expect(prompt).toContain('NEVER stage');
  });

  it('includes revision context when provided', async () => {
    const { fixerPrompt } = await internals();
    const issue = { file: 'test.js', description: 'fix this' };
    const survey = { languages: ['JavaScript'] };
    const revisionCtx = { priorSha: 'def456', objection: 'The fix was incomplete' };

    const prompt = fixerPrompt(issue, survey, 'abc123', 'undefined', [], revisionCtx);

    expect(prompt).toContain('REVISION');
    expect(prompt).toContain('def456');
    expect(prompt).toContain('The fix was incomplete');
    expect(prompt).toContain('REJECTED');
  });
});

describe('reconcilePrompt', () => {
  it('instructs the agent to pin to the review head first', async () => {
    const { reconcilePrompt } = await internals();
    const groupFixes = [
      { sha: 'abc123', branch: 'fix-1', changedFiles: ['test.js'], reason: 'fixed bug' },
    ];
    const survey = { languages: ['JavaScript'] };

    const prompt = reconcilePrompt(groupFixes, 0, survey, 'def456', []);

    expect(prompt).toContain('PIN YOUR BASE');
    expect(prompt).toContain('git rev-parse');
    expect(prompt).toContain('def456');
  });

  it('lists all fixes to combine with their SHAs and files', async () => {
    const { reconcilePrompt } = await internals();
    const groupFixes = [
      { sha: 'abc123', branch: 'fix-1', changedFiles: ['test.js'], reason: 'fixed bug' },
      { sha: 'def456', branch: 'fix-2', changedFiles: ['other.js'], reason: 'fixed other' },
    ];
    const survey = { languages: ['JavaScript'] };

    const prompt = reconcilePrompt(groupFixes, 0, survey, 'head123', []);

    expect(prompt).toContain('abc123');
    expect(prompt).toContain('def456');
    expect(prompt).toContain('test.js');
    expect(prompt).toContain('other.js');
    expect(prompt).toContain('git show');
  });

  it('includes the critical STAY IN BOUNDS warning', async () => {
    const { reconcilePrompt } = await internals();
    const groupFixes = [
      { sha: 'abc123', branch: 'fix-1', changedFiles: ['test.js'], reason: 'fixed bug' },
    ];
    const survey = { languages: ['JavaScript'] };

    const prompt = reconcilePrompt(groupFixes, 0, survey, 'head123', []);

    expect(prompt).toContain('STAY IN BOUNDS');
    expect(prompt).toContain('only the files the fixes you are merging already touched');
    expect(prompt).toContain('un-landable');
  });

  it('lists the in-bounds files explicitly', async () => {
    const { reconcilePrompt } = await internals();
    const groupFixes = [
      { sha: 'abc123', branch: 'fix-1', changedFiles: ['test.js', 'util.js'], reason: 'fixed bug' },
      { sha: 'def456', branch: 'fix-2', changedFiles: ['util.js', 'other.js'], reason: 'fixed other' },
    ];
    const survey = { languages: ['JavaScript'] };

    const prompt = reconcilePrompt(groupFixes, 0, survey, 'head123', []);

    expect(prompt).toContain('In-bounds files');
    expect(prompt).toContain('test.js');
    expect(prompt).toContain('util.js');
    expect(prompt).toContain('other.js');
  });

  it('instructs use of git add with explicit paths, never git add -A', async () => {
    const { reconcilePrompt } = await internals();
    const groupFixes = [
      { sha: 'abc123', branch: 'fix-1', changedFiles: ['test.js'], reason: 'fixed bug' },
    ];
    const survey = { languages: ['JavaScript'] };

    const prompt = reconcilePrompt(groupFixes, 0, survey, 'head123', []);

    expect(prompt).toContain('git add -- <paths>');
    expect(prompt).toContain('never `git add -A`');
  });
});

describe('fixReviewPrompt', () => {
  it('instructs the reviewer to inspect the commit with git show', async () => {
    const { fixReviewPrompt } = await internals();
    const issue = { file: 'test.js', description: 'fix this' };
    const fixResult = { sha: 'abc123', changedFiles: ['test.js'], reason: 'fixed it' };
    const survey = { languages: ['JavaScript'] };

    const prompt = fixReviewPrompt(issue, fixResult, survey);

    expect(prompt).toContain('git show abc123');
    expect(prompt).toContain('Inspect the change read-only');
  });

  it('instructs the reviewer NOT to trust the fixer', async () => {
    const { fixReviewPrompt } = await internals();
    const issue = { file: 'test.js', description: 'fix this' };
    const fixResult = { sha: 'abc123', changedFiles: ['test.js'], reason: 'fixed it' };
    const survey = { languages: ['JavaScript'] };

    const prompt = fixReviewPrompt(issue, fixResult, survey);

    expect(prompt).toContain('do NOT trust the fixer');
    expect(prompt).toContain('Judge that commit independently');
  });

  it('instructs the reviewer not to run tests or modify anything', async () => {
    const { fixReviewPrompt } = await internals();
    const issue = { file: 'test.js', description: 'fix this' };
    const fixResult = { sha: 'abc123', changedFiles: ['test.js'], reason: 'fixed it' };
    const survey = { languages: ['JavaScript'] };

    const prompt = fixReviewPrompt(issue, fixResult, survey);

    expect(prompt).toContain('do not modify anything');
    expect(prompt).toContain('do not run the tests');
  });

  it('requires judging both correctness and quality', async () => {
    const { fixReviewPrompt } = await internals();
    const issue = { file: 'test.js', description: 'fix this' };
    const fixResult = { sha: 'abc123', changedFiles: ['test.js'], reason: 'fixed it' };
    const survey = { languages: ['JavaScript'] };

    const prompt = fixReviewPrompt(issue, fixResult, survey);

    expect(prompt).toContain('correctness');
    expect(prompt).toContain('quality');
    expect(prompt).toContain('minimal');
    expect(prompt).toContain('no new bugs');
  });

  it('requires specific actionable objection when rejecting', async () => {
    const { fixReviewPrompt } = await internals();
    const issue = { file: 'test.js', description: 'fix this' };
    const fixResult = { sha: 'abc123', changedFiles: ['test.js'], reason: 'fixed it' };
    const survey = { languages: ['JavaScript'] };

    const prompt = fixReviewPrompt(issue, fixResult, survey);

    expect(prompt).toContain('specific, actionable objection');
    expect(prompt).toContain('fixer can act on');
  });

  it('requires structured result with approved and objection fields', async () => {
    const { fixReviewPrompt } = await internals();
    const issue = { file: 'test.js', description: 'fix this' };
    const fixResult = { sha: 'abc123', changedFiles: ['test.js'], reason: 'fixed it' };
    const survey = { languages: ['JavaScript'] };

    const prompt = fixReviewPrompt(issue, fixResult, survey);

    expect(prompt).toContain('approved');
    expect(prompt).toContain('objection');
  });
});
