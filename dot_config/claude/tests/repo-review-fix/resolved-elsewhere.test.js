/**
 * `resolved-elsewhere`: the status that retires a finding without a commit.
 *
 * It exists because of the split. Bundled, a fixer opened the file minutes after the reviewer that found the defect, on
 * the same commit; "the defect is not there" was near enough impossible that no status covered it. Standalone, the
 * findings come out of a ledger written at some earlier commit and the sandbox is pinned to current `HEAD`, so a fixer
 * finding nothing is now ordinary — the user fixed it by hand, another fix in an earlier batch subsumed it, or the code
 * was deleted outright.
 *
 * Without a status of its own, the honest answer is `declined`, which the ledger reads as *tried and could not*. The
 * finding is then re-offered every run, and every run pays a fixer to rediscover that there is nothing to fix — a
 * permanent tax on a ledger that can only grow. So it is a first-class status, and this suite pins the four things that
 * have to follow from it: no reviewer is spawned for it, its branch is not kept, it is counted separately in the log,
 * and the fixer is told it is an acceptable answer rather than left to force something.
 */

import { describe, expect, it } from 'vitest';

import { HEAD, REVIEWED, appliedFix, internals, issue, runFix } from './scenario.js';

// What a fixer returns when step 1 finds nothing to fix: the branch it created in step 0, and no commit on it.
const gone = (_subject, { idx = 0 } = {}) => ({
  status: 'resolved-elsewhere',
  sha: '',
  branch: `rrfix/wf_test/${idx}`,
  changedFiles: [],
  reason: 'already fixed upstream',
});

const labels = (run) => run.calls.map((call) => call.label);

describe('the status reaches the caller', () => {
  it('is reported as the finding\'s outcome verbatim, not translated into a failure', async () => {
    const { STATUS_RESOLVED_ELSEWHERE } = await internals({});
    const run = await runFix({ fix: gone });

    expect(run.result.outcomes).toHaveLength(1);
    expect(run.result.outcomes[0]).toMatchObject({
      status: STATUS_RESOLVED_ELSEWHERE,
      reason: 'already fixed upstream',
    });
  });

  it('carries the finding\'s fingerprint, which is what the ledger retires it by', async () => {
    // The wrapper cannot retire a finding by position — the ledger is re-read next run and the order will differ. The
    // fingerprint is the only handle that survives, so an outcome without one retires nothing.
    const { fingerprint } = await internals({});
    const finding = issue({ description: 'a defect someone else already fixed' });
    const run = await runFix({ fix: gone, args: { findings: [finding] } });

    expect(run.result.outcomes[0].fingerprint).toBe(fingerprint(finding));
  });

  it('is in the schema the fixers are validated against', async () => {
    // The status is only reachable if a fixer can return it: the schema is enforced at the tool-call layer, so an enum
    // missing it would make the model retry until it picked one of the failure statuses instead.
    const { FIX_RESULT_SCHEMA, STATUS_RESOLVED_ELSEWHERE } = await internals({});

    expect(FIX_RESULT_SCHEMA.properties.status.enum).toContain(STATUS_RESOLVED_ELSEWHERE);
  });
});

describe('what it costs', () => {
  it('spawns no fix reviewer, because there is no commit to review', async () => {
    const run = await runFix({ fix: gone });

    expect(labels(run)).toEqual(['survey', 'fix:bug#0']);
  });

  it('spawns no revision either, so a retired finding cannot loop', async () => {
    // The revise loop is entered only by an `applied` fix that was rejected. A status that fell through to it would
    // spend up to FIX_REVISION_CAP further fixers each insisting there is nothing there.
    const run = await runFix({ fix: gone });

    expect(labels(run).filter((label) => label.startsWith('revise:'))).toEqual([]);
  });

  it('leaves the other findings in the batch to be fixed normally', async () => {
    // Per-finding, not run-wide: one retired finding must not shorten the batch.
    const findings = [issue({ file: 'src/a.ts' }), issue({ file: 'src/b.ts', category: 'security' })];
    const run = await runFix({
      args: { findings },
      fix: (subject, label) => (subject.file === 'src/a.ts' ? gone(subject, label) : appliedFix(subject, label)),
    });

    expect(run.result.outcomes.map((outcome) => outcome.status)).toEqual(['resolved-elsewhere', 'applied']);
    expect(labels(run)).toContain('review-fix:security#1');
    expect(labels(run)).not.toContain('review-fix:bug#0');
  });
});

describe('teardown', () => {
  it('does not keep the branch, since it holds nothing', async () => {
    // The sandbox exists — step 0 created the branch before step 1 discovered there was nothing to fix — so it is on the
    // teardown list; but it sits at the base commit, and keeping a ref to an empty branch is clutter the next run trips
    // over when it tries to create a name that already exists.
    const run = await runFix({ fix: gone });

    expect(run.result.sandboxBranches).toContain('rrfix/wf_test/0');
    expect(run.result.keepBranches).toEqual([]);
  });

  it('keeps a branch that does hold a commit, so the two are really being told apart', async () => {
    const run = await runFix();

    expect(run.result.keepBranches).toEqual(['rrfix/wf_test/0']);
  });
});

describe('how the fixer is told about it', () => {
  it('presents it as a useful answer rather than a failure', async () => {
    // The pressure runs the other way by default: an agent handed a finding and asked to fix it will look for something
    // adjacent to change rather than come back empty. Naming the empty answer as the *point* is what makes it available.
    const { fixerPrompt } = await internals({});
    const prompt = fixerPrompt(issue(), {}, HEAD, REVIEWED, '0', []);

    expect(prompt).toContain('`{ status: "resolved-elsewhere", reason }`');
    expect(prompt).toContain('That is a useful answer, not a failure');
    expect(prompt).toMatch(/do not stretch to find something adjacent to fix/);
  });

  it('asks for the confirmation before it asks for the fix', async () => {
    const { fixerPrompt } = await internals({});
    const prompt = fixerPrompt(issue(), {}, HEAD, REVIEWED, '0', []);

    expect(prompt.indexOf('confirm the issue is still present')).toBeLessThan(prompt.indexOf('2. If it is still there'));
  });

  it('is offered even when the tree has not drifted, since a hand-fix leaves no drift', async () => {
    // The drift note is conditional; the confirmation step is not. A user who fixed the defect and committed nothing —
    // or whose fix came in the very commit the survey read — produces `base === reviewedCommit` and a finding that is
    // nonetheless gone.
    const run = await runFix({ args: { reviewedCommit: HEAD }, fix: gone });
    const [, fixer] = run.calls;

    expect(fixer.prompt).not.toContain('The tree has moved since the review');
    expect(fixer.prompt).toContain('`{ status: "resolved-elsewhere", reason }`');
    expect(run.result.outcomes[0].status).toBe('resolved-elsewhere');
  });
});

describe('the run-level summary', () => {
  it('counts retired findings apart from fixed and unfixed ones', async () => {
    const findings = [issue({ file: 'src/a.ts' }), issue({ file: 'src/b.ts' }), issue({ file: 'src/c.ts' })];
    const run = await runFix({
      args: { findings },
      fix: (subject, label) => {
        if (subject.file === 'src/a.ts') return gone(subject, label);
        if (subject.file === 'src/b.ts') {
          return { ...appliedFix(subject, label), status: 'declined', sha: '', reason: 'not safely fixable' };
        }

        return appliedFix(subject, label);
      },
    });

    // Reported as three separate figures, because they call for three different things from the user: read the branch,
    // ignore it, look at the finding by hand.
    expect(run.logs.join('\n')).toContain('1 approved, 1 already resolved, 1 unfixed');
  });

  it('raises no gap: a finding that is genuinely gone is not a shortfall', async () => {
    const run = await runFix({ fix: gone });

    expect(run.result.gaps).toEqual([]);
  });
});
