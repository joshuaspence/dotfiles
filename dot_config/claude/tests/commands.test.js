/**
 * Invariants every slash-command file must satisfy, checked against the file itself rather than a transcription of it.
 *
 * A command file is prose: nothing in it executes, so nothing in it fails loudly. Its defects are agreement defects — it
 * documents a flag the script does not read, names a workflow that does not exist, or contains a character sequence the
 * command loader rewrites before the model ever sees it. Each one produces a command that runs, does something slightly
 * different from what it says, and reports success.
 *
 * The last of those is not hypothetical. `$` immediately followed by a digit is an *argument reference* in a command
 * file: the loader substitutes the nth positional argument, which is almost always empty. It silently emptied a table of
 * model prices in `repo-review.md` for months — the text was correct in the repository and arrived at the model with the
 * figures gone. No test could see it, because every test read the source file.
 */

import { describe, expect, it } from 'vitest';

import { commandFiles, readCommand, readScript, workflowScripts } from './harness.js';

const WORKFLOW_NAMES = new Set(workflowScripts().map((script) => script.name));

// Flags as the frontmatter's `argument-hint` lists them, e.g. `[--max-fixes <n>]`.
const hintedFlags = (frontmatter) => {
  const [, hint] = /^argument-hint:([\s\S]*?)(?=^\S)/m.exec(frontmatter) || [];

  return new Set([...(hint || '').matchAll(/--[a-z][a-z-]*/g)].map(([flag]) => flag));
};

// Flags the body documents, i.e. those introduced by a top-level bullet whose first token is the flag. Prose mentions do
// not count: a command file legitimately discusses a flag it removed, and `repo-review.md` explains at length why
// `--loop` is gone.
const documentedFlags = (body) => new Set([...body.matchAll(/^- `(--[a-z][a-z-]*)/gm)].map(([, flag]) => flag));

describe.each(commandFiles())('$name', ({ path }) => {
  it('contains no `$`-plus-digit sequence, which the loader would substitute away', () => {
    const { source } = readCommand(path);
    const offenders = source
      .split('\n')
      .map((line, idx) => [idx + 1, line])
      .filter(([, line]) => /\$\d/.test(line));

    // The whole line is reported, not just the match: the substitution is invisible in the source, so the only way to
    // recognise the defect is to see the text it was hiding in.
    const advice =
      'A `$` followed by a digit is a positional-argument reference and is replaced before the model reads the file. ' +
      'Reword — put the figure in backticks with the `$` outside, or spell out "dollars".';

    expect(offenders, advice).toEqual([]);
  });

  it('declares the frontmatter keys the command loader needs', () => {
    const { frontmatter } = readCommand(path);

    for (const key of ['name:', 'description:', 'allowed-tools:']) {
      expect(frontmatter, `${path} is missing the \`${key}\` frontmatter key`).toContain(key);
    }
  });

  it('documents every flag it advertises, and advertises every flag it documents', () => {
    // Two different failures, one check. A hinted flag that nothing documents is a flag the model has to guess at,
    // and — since the hint is what the user sees while typing — a documented flag left out of the hint is one nobody
    // discovers.
    const { frontmatter, body } = readCommand(path);

    expect([...hintedFlags(frontmatter)].sort()).toEqual([...documentedFlags(body)].sort());
  });

  it('names a workflow that exists, if it drives one', () => {
    // The wrapper passes this string to the `Workflow` tool by name, and a name that resolves to nothing fails at launch
    // with no indication that the file's own text is what is wrong.
    const { body } = readCommand(path);
    const named = [...body.matchAll(/^- `name` — the string `([a-z][a-z0-9-]*)`/gm)].map(([, workflow]) => workflow);

    for (const workflow of named) {
      expect(WORKFLOW_NAMES, `${path} tells the model to run a workflow named '${workflow}'`).toContain(workflow);
    }
  });
});

describe('repo-review-fix', () => {
  // This command's whole input is arguments it forwards to the script, so the two files agreeing about their names is
  // the interface. A key the wrapper spells differently is not an error anywhere: the script sees `undefined`, applies
  // its default, and returns a result that reads as though the flag had never been passed.
  const { frontmatter, body } = readCommand(commandFiles().find((command) => command.name === 'repo-review-fix').path);
  const script = readScript(workflowScripts().find((s) => s.name === 'repo-review-fix').path);

  // Every `args` key the worked-example table shows, plus the three the ledger supplies.
  const KEYS = ['findings', 'exclusions', 'reviewedCommit', 'severity', 'maxFixes', 'reviewers', 'effort'];

  it.each(KEYS)('passes `%s`, which the script reads off `input`', (key) => {
    expect(body).toContain(`\`${key}\``);
    expect(script).toContain(`input?.${key}`);
  });

  it('never tells the wrapper to pass a flag through under its command-line spelling', () => {
    // `--max-fixes` becomes `maxFixes`, and the hyphenated form in an `args` object is the mistake that looks right.
    const [, table] = /\n(\| Invocation[\s\S]*?)\n\n/.exec(body) || [];

    expect(table).toBeTruthy();
    expect(table).not.toMatch(/"--/);
    expect(table).not.toMatch(/"max-fixes"/);
  });

  it('withholds from the script exactly the flags the script does not read', () => {
    // `--output` is handled by the wrapper. The check is that the file says so *and* that the script really has no such
    // input — a script that grew an `output` key while the command still withheld it would be a silently ignored flag.
    expect(hintedFlags(frontmatter)).toContain('--output');
    expect(body).toMatch(/do \*\*not\*\* pass\s+it to the script/);
    expect(script).not.toContain('input?.output');
  });

  it('declares the git it actually asks for, and nothing that writes', () => {
    // The command's posture is "verify and tear down, never land". `allowed-tools` is where that is enforced rather than
    // promised, so a write verb appearing here is the one way the prose could be overruled.
    for (const tool of ['git rev-parse', 'git worktree remove', 'git branch --delete --force']) {
      expect(frontmatter).toContain(tool);
    }

    for (const forbidden of ['git commit', 'git cherry-pick', 'git merge', 'git push', 'git switch', 'git rebase']) {
      expect(frontmatter, `${forbidden} must not be in allowed-tools: this command lands nothing`).not.toContain(
        forbidden,
      );
    }
  });

  it('agrees with the script about the statuses an outcome can carry', async () => {
    // The status table in the report section is what the wrapper branches on — which findings get a table row, which get
    // retired from the ledger. A status the script can return and the file does not list is a finding reported wrongly.
    // Read out of the schema itself, so adding a status to the script fails here until the table explains it.
    const { internals } = await import('./repo-review-fix/scenario.js');
    const { FIX_RESULT_SCHEMA, STATUS_REVIEW_REJECTED } = await internals({});

    for (const status of [...FIX_RESULT_SCHEMA.properties.status.enum, STATUS_REVIEW_REJECTED]) {
      expect(body, `the status \`${status}\` is missing from the outcome table`).toContain(`| \`${status}\``);
    }
  });

  it('tells the wrapper to leave the review-owned ledger fields alone', () => {
    // The ledger is written by the other command. This one retires resolved findings and records branches; writing
    // `reviewedCommit` from `base` would assert that the current tree has been reviewed when it has not, which
    // suppresses everything a real review of it would find.
    expect(body).toMatch(/Do \*\*not\*\* touch `reviewedCommit` or `round`/);
  });
});
