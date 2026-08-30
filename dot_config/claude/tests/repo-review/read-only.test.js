/**
 * The read-only boundary of every phase.
 *
 * Nothing in this command sets `isolation: 'worktree'` — the agents that commit live in `/repo-review-fix`. So every
 * agent here runs in the user's live checkout while holding the same tools it would in a sandbox, and the script has no
 * way to take those tools away: the only thing standing between a review and a dirty working tree is the sentence its
 * prompt happens to carry. Stating that per prompt is how Validate — the highest fan-out phase — came to be the one
 * prompt with no execution guard at all, invisibly.
 *
 * So the table below is where that invariant lives. It must name a guard for every agent a run produces, so deleting a
 * guard, or adding a phase without one, fails here rather than waiting for a review. That only holds if the fixture is
 * wide enough to reach every phase: the architecture lenses are skipped on a narrow scope and the `CLAUDE.md` scan is
 * skipped on a repository without one, and a table scoped to a two-file happy path would read as complete while saying
 * nothing about either. The one phase that used to be reachable *only* on a degraded path — the `headSha` re-ask — left
 * with the fixing, since a re-ask exists to pin a sandbox and this command pins nothing.
 */

import { describe, expect, it } from 'vitest';

import { issue, runReview } from './scenario.js';

// One phrase per phase, quoted from the prompt that carries it. Substrings, not shapes: the point is that the words
// reach the agent, which is the only enforcement that exists. Each phrase has to forbid an action, too — the first three
// rows once quoted "do not walk the filesystem" and "enumerate with `git ls-files`", which say how to list files and
// nothing about touching them, so those phases read as guarded here while their prompts named no prohibition a later
// edit could remove.
const GUARDS = [
  { phase: 'survey', label: /^survey\b/, guard: 'do not modify, create, or delete any file' },
  { phase: 'CLAUDE.md scan', label: /^claude-md-scan\b/, guard: 'do not modify, create, or delete any file' },
  { phase: 'partition', label: /^partition\b/, guard: 'do not modify, create, or delete any file' },
  { phase: 'review', label: /^review:/, guard: 'Do not build, typecheck, lint, or test the repository' },
  { phase: 'dedupe', label: /^dedupe\b/, guard: 'do not read files and do not run any commands' },
  { phase: 'validate', label: /^validate:/, guard: 'do not build, typecheck, lint, or test the repository' },
];

// A run wide enough to reach every phase at once: two units, so the per-unit and the cross-unit dedupe agents both run,
// over four in-scope files, since the architecture lenses are skipped on a scope of two or fewer.
const wideRun = () =>
  runReview({
    issues: [
      issue({ file: 'src/a.ts' }),
      issue({ file: 'src/b.ts', category: 'security' }),
      issue({ file: 'lib/c.ts', category: 'code-quality' }),
    ],
    units: [
      { name: 'core', summary: 'the entry points', paths: ['src/a.ts', 'src/b.ts'] },
      { name: 'lib', summary: 'the library', paths: ['lib/c.ts', 'lib/d.ts'] },
    ],
    unitPaths: ['src/a.ts', 'src/b.ts', 'lib/c.ts', 'lib/d.ts'],
  });

// Read from what the script actually asked for rather than from a list of labels kept here.
const liveAgents = async () => (await wideRun()).calls;

describe('every agent is told not to write to the checkout', () => {
  it.each(GUARDS)('tells the $phase agents: $guard', async ({ label, guard }) => {
    const guarded = (await liveAgents()).filter((call) => label.test(call.label));

    // No matching agent means the phase is gone, renamed, or now sandboxed — any of which makes the assertion below
    // vacuously true, so fail instead and make someone re-read the table.
    expect(guarded.length).toBeGreaterThan(0);

    for (const call of guarded) expect(call.prompt, `${call.label} carries no read-only guard`).toContain(guard);
  });

  it('has an entry for every agent the run produced', async () => {
    const unlisted = [
      ...new Set(
        (await liveAgents())
          .filter((call) => !GUARDS.some(({ label }) => label.test(call.label)))
          .map((call) => call.label),
      ),
    ];

    // A new phase has to state its own guard and be listed above. Nothing else in the script owns this, so an unlisted
    // label is an unguarded agent until proven otherwise.
    expect(unlisted).toEqual([]);
  });
});

describe('the validators specifically', () => {
  it('run in the live checkout, and are told not to build or test it', async () => {
    // Validate is `findings × validators` agents deep, each holding Bash and several asked to confirm a claim that is
    // itself about build or test behaviour. One that settles such a claim by running the build leaves `node_modules/` or
    // coverage output behind, which breaks this command's read-only contract outright — and then costs a second time,
    // because `/repo-review-fix` runs next over the same checkout and cannot tell its own sandboxes' output from a dirty
    // tree it inherited.
    const run = await wideRun();
    const [validator] = run.called(/^validate:/);

    expect(validator.opts.isolation).toBeUndefined();
    expect(validator.prompt).toContain('do not modify, create, or delete any file');
    expect(validator.prompt).toContain('do not build, typecheck, lint, or test the repository');
  });

  it('are not left thinking read-only search is off limits too', async () => {
    // The guard has to forbid actions, not declare an exhaustive toolkit. A validator that read it as "reading files is
    // all you may do" would abstain on a repository-wide finding rather than grep for it — and on a strict-majority
    // gate, two abstentions silently drop a real defect.
    const run = await wideRun();
    const [validator] = run.called(/^validate:/);

    expect(validator.prompt).toContain('Read-only inspection is otherwise unrestricted');
    expect(validator.prompt).toContain('search and enumerate as widely as the claim needs');
  });
});
