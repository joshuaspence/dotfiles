/**
 * The base commit every sandbox is pinned to, and what happens when it cannot be determined.
 *
 * `isolation: 'worktree'` does not check the worktree out at local `HEAD` — it branches from the *remote* default
 * branch, which in one observed run was 126 commits behind the tree the reviewers had read. So each sandbox has to be
 * moved onto an explicit SHA, and the SHA has to be one the script actually knows. Splitting the fix half out changed
 * where it comes from: bundled, the review had already surveyed the tree and every fixer pinned to that; standalone, the
 * findings arrive from a ledger written at some earlier commit, so this command surveys for itself and pins to *current*
 * `HEAD` — with the reviewed commit demoted to context the fixer is told about.
 *
 * Two properties are load-bearing and neither shows up in a passing run's output:
 *
 *   the pin names the surveyed commit, not the reviewed one — pin to the reviewed commit and every fix is parented on
 *     history that the local tree has moved past, which is the original defect in a new costume;
 *
 *   no SHA means no fixers — an unpinned sandbox still *works*: agents edit stale files, verification passes against
 *     stale tests, and branches come back looking like fixes. Declining is the only outcome that does not lie.
 */

import { describe, expect, it } from 'vitest';

import { HEAD, REVIEWED, internals, issue, promptIssue, runFix } from './scenario.js';

const fixCalls = (run) => run.calls.filter((call) => /^(fix|revise):/.test(call.label));

const REFUSAL = /base commit SHA could not be determined/;

describe('what the sandbox is pinned to', () => {
  it('pins to the commit the survey read, not the commit the findings were written against', async () => {
    const run = await runFix();
    const [fixer] = fixCalls(run);

    expect(fixer.prompt).toContain(`git switch -c rrfix/<RUN>/0 ${HEAD}`);
    expect(fixer.prompt).toContain(`\`git rev-parse HEAD\` must print exactly \`${HEAD}\``);

    // The reviewed commit appears in the prompt — as the drift note below — but never as a checkout target.
    expect(fixer.prompt).not.toContain(`git switch -c rrfix/<RUN>/0 ${REVIEWED}`);
    expect(run.result.base).toBe(HEAD);
    expect(run.result.reviewedCommit).toBe(REVIEWED);
  });

  it('checks the parent of the commit it made, so a fix that drifted mid-run is caught', async () => {
    // Step 0 verifies the pin before any edit; step 5 verifies it after the commit. Both are needed: an agent that
    // rebased or amended between them lands a commit whose diff is not the fix the reporter describes.
    const run = await runFix();

    expect(fixCalls(run)[0].prompt).toContain(`\`git rev-parse HEAD~1\` must still print \`${HEAD}\``);
  });

  it('gives each finding its own branch suffix, so concurrent sandboxes cannot collide', async () => {
    const findings = [issue({ file: 'src/a.ts' }), issue({ file: 'src/b.ts' })];
    const run = await runFix({ args: { findings } });
    const suffixes = fixCalls(run).map((call) => /git switch -c rrfix\/<RUN>\/(\S+) /.exec(call.prompt)[1]);

    expect(new Set(suffixes).size).toBe(2);
  });

  it('pins a revision too, on a branch of its own', async () => {
    // A revision is a fresh sandbox, so it needs the pin as much as the first attempt did — and on its own branch, since
    // the rejected commit is kept for the user to read and a revision committing over it would destroy the thing the
    // rejection is about.
    const run = await runFix({ reviewFix: () => ({ approved: false, objection: 'misses a case' }) });
    const [revision] = run.called(/^revise:/);

    expect(revision.prompt).toContain(`git switch -c rrfix/<RUN>/0-r1 ${HEAD}`);
  });

  it('does not claim the sandbox is already at the commit being fixed', async () => {
    // The prompt used to assert this. It was false, and it was worse than saying nothing: a few fixers noticed the
    // mismatch and re-based themselves while most trusted the claim, which is how one run produced four bases.
    const run = await runFix();
    const [fixer] = fixCalls(run);

    expect(fixer.prompt).not.toContain('checked out at the repository');
    expect(fixer.prompt).toContain('Your worktree is **not** checked out at the commit you are fixing');
  });
});

describe('the sandbox the pin is applied inside', () => {
  // `isolation: 'worktree'` is the entire containment story for the agents that hold Edit and run `git switch -c` /
  // `git add` / `git commit`. Deleting it would turn N concurrent fixers loose on the user's live checkout, branching
  // and committing in it — and every prompt assertion above reads identically either way, so without these two tests
  // nothing in the suite would notice.
  const COMMITTING = /^(fix|revise):/;

  // One run that reaches both kinds: two findings, and rejecting finding 0's first attempt adds a reviser. The two
  // findings deliberately sit in the same file, which is the case a fix run simply allows — each gets its own branch and
  // the overlap is the user's to resolve if they ever merge both.
  const busy = () =>
    runFix({
      args: { findings: [issue({ file: 'src/a.ts' }), issue({ file: 'src/a.ts', description: 'a second finding' })] },
      reviewFix: (_subject, { idx, attempt }) =>
        idx === 0 && attempt === 0 ? { approved: false, objection: 'misses a case' } : { approved: true, objection: '' },
    });

  it('is requested by every fixer and reviser', async () => {
    const run = await busy();
    const committing = run.called(COMMITTING);

    // Count them first: a renamed label would otherwise leave the loop below iterating an empty list and passing.
    expect(run.called(/^fix:/)).toHaveLength(2);
    expect(run.called(/^revise:/)).toHaveLength(1);
    expect(committing).toHaveLength(3);

    for (const call of committing) {
      expect(call.opts.isolation).toBe('worktree');
    }
  });

  it('is requested by nothing else in that run, the survey and the fix reviewers being read-only', async () => {
    const run = await busy();
    const stray = run.calls.filter((call) => !COMMITTING.test(call.label) && call.opts.isolation !== undefined);

    expect(stray.map((call) => call.label)).toEqual([]);
  });
});

describe('the drift note', () => {
  it('names both commits, so the fixer can weigh a stale description against live code', async () => {
    const run = await runFix();
    const [fixer] = fixCalls(run);

    expect(fixer.prompt).toContain(`reported against commit \`${REVIEWED}\``);
    expect(fixer.prompt).toContain(`you are fixing \`${HEAD}\``);
  });

  it('is absent when the tree has not moved since the review', async () => {
    // With the ledger fresh there is no drift to explain, and saying "the tree has moved" when it has not invites the
    // fixer to distrust an accurate description — the same words cost nothing when true and mislead when false.
    const run = await runFix({ args: { reviewedCommit: HEAD } });

    expect(fixCalls(run)[0].prompt).not.toContain('The tree has moved since the review');
  });

  it('is absent when the caller supplied no reviewed commit at all', async () => {
    const run = await runFix({ args: { reviewedCommit: null } });

    expect(fixCalls(run)[0].prompt).not.toContain('The tree has moved since the review');
    expect(run.result.reviewedCommit).toBe(null);
  });

  it('drops a reviewed commit that is not a full object name rather than quoting it at the fixer', async () => {
    // An abbreviated or bogus SHA in the ledger is a value the fixer would be told to run `git show` adjacent to. It is
    // dropped for the same reason `base` is required to be full: a 7-character name is ambiguous and a non-hex one is
    // untrusted input arriving in a prompt.
    const run = await runFix({ args: { reviewedCommit: '4f1c0a7' } });

    expect(run.result.reviewedCommit).toBe(null);
    expect(fixCalls(run)[0].prompt).not.toContain('4f1c0a7');
  });

  it('accepts a reviewed commit in either case, since git prints hex either way', async () => {
    const { fullCommitSha } = await internals({});

    expect(fullCommitSha(REVIEWED.toUpperCase())).toBe(REVIEWED);
  });
});

describe('when the base cannot be determined', () => {
  // Each of these is a different way the one agent the run depends on fails to supply the one field it needs. All three
  // must reach the same refusal, because the harm — branches presented as fixes for code they were not written against
  // — does not care which one happened.

  it('refuses when the survey never returned', async () => {
    const run = await runFix({ survey: null });

    expect(fixCalls(run)).toEqual([]);
    expect(run.result).toMatchObject({ base: null, selected: 1, outcomes: [], sandboxBranches: [] });
    expect(run.result.gaps.join('\n')).toMatch(REFUSAL);
  });

  it('refuses when the survey answered without a head SHA', async () => {
    const run = await runFix({ headSha: '' });

    expect(fixCalls(run)).toEqual([]);
    expect(run.result.base).toBe(null);
    expect(run.result.gaps.join('\n')).toMatch(REFUSAL);
  });

  it('refuses when the survey abbreviated the head SHA', async () => {
    // The abbreviated form is the plausible failure: `git rev-parse --short HEAD` is a natural thing for an agent to
    // reach for, it looks right in the returned object, and `git switch -c <branch> cd976db` would even succeed — while
    // step 0's `git rev-parse HEAD` equality check against the short string fails in all 5 sandboxes at once.
    const run = await runFix({ headSha: HEAD.slice(0, 7) });

    expect(fixCalls(run)).toEqual([]);
    expect(run.result.base).toBe(null);
    expect(run.result.gaps.join('\n')).toMatch(REFUSAL);
  });

  it('refuses when the surveyed SHA is not hex at all', async () => {
    const run = await runFix({ headSha: 'HEAD; rm -rf /' });

    expect(fixCalls(run)).toEqual([]);
    expect(run.result.base).toBe(null);
  });

  it('refuses rather than dying when the survey agent stalls', async () => {
    // A stalled agent *throws* (the no-progress watchdog kills it), and the survey is the first agent in the run — so an
    // unguarded throw escapes the whole workflow and the caller gets an error instead of a result. The distinction that
    // matters to the wrapper: this run reports the same refusal as any other unpinnable one, with the findings intact in
    // the ledger, rather than a crash it has to interpret.
    const run = await runFix({
      survey: () => {
        throw new Error('agent made no progress for 180s');
      },
    });

    expect(fixCalls(run)).toEqual([]);
    expect(run.result.base).toBe(null);
    expect(run.result.gaps.join('\n')).toMatch(REFUSAL);
  });

  it('still reports the selection it had computed, so the refusal is legible as a refusal', async () => {
    // `selected` is what separates "there was nothing to do" from "there were 3 fixes to make and I could not safely
    // make them". Zeroing it here would make an unpinnable run indistinguishable from an empty ledger.
    const findings = [issue({ file: 'src/a.ts' }), issue({ file: 'src/b.ts' }), issue({ file: 'src/c.ts' })];
    const run = await runFix({ survey: null, args: { findings } });

    expect(run.result).toMatchObject({ considered: 3, selected: 3, outcomes: [] });
  });

  it('says the findings are not verified as unfixable, since nothing looked at them', async () => {
    // The ledger is updated from this result. A refusal that reads as "could not be fixed" retires findings that were
    // never opened, and they are then never offered again.
    const run = await runFix({ survey: null });

    expect(run.result.gaps.join('\n')).toMatch(/\*\*not\*\* verified as unfixable/);
  });
});

describe('the pin instruction itself', () => {
  it('is the first numbered step, ahead of anything that reads a file', async () => {
    const { fixerPrompt, pinToBase } = await internals({});

    expect(pinToBase(HEAD, '0', 'stop.')).toMatch(/^0\. PIN YOUR BASE/);

    const prompt = fixerPrompt(issue(), {}, HEAD, REVIEWED, '0', []);

    expect(prompt.indexOf('0. PIN YOUR BASE')).toBeLessThan(prompt.indexOf('1. Open the cited file(s)'));
  });

  it('tells the agent what to do when the pin does not take, rather than leaving it to improvise', async () => {
    // Pinning was agent initiative once, and the outcome was a split field: some fixers re-based themselves, most
    // committed onto the stale base. An instruction with no failure branch is an instruction that gets improvised.
    const { pinToBase } = await internals({});

    expect(pinToBase(HEAD, '0', 'return declined and name the SHA.')).toContain('return declined and name the SHA.');
  });

  it('forbids the placeholder run ids that real runs produced', async () => {
    const { pinToBase } = await internals({});
    const prompt = pinToBase(HEAD, '0', 'stop.');

    expect(prompt).toMatch(/Never put the word `undefined`, `null`, or an empty segment in a branch name/);
  });

  it('gives the run-id derivation as one mechanical rule every agent reaches the same answer from', async () => {
    // The `<RUN>` segment cannot come from the script — it has no handle on the workflow id — so each agent derives it
    // from its own sandbox branch name. The rule has to be mechanical: an earlier wording ("extract the wf_<id> token")
    // admitted two different answers, and agents that disagreed put their branches outside the wrapper's teardown.
    const { pinToBase } = await internals({});
    const prompt = pinToBase(HEAD, '0', 'stop.');

    expect(prompt).toContain('stripping the leading `worktree-` and the trailing `-<agentNumber>`');
    expect(prompt).toContain('every agent in this run must derive the *same* `<RUN>`');
  });

  it('gives that derivation as a command, because agents asked to do it in their heads got it wrong', async () => {
    // Prose alone did not hold: in one run 49 agents reported `rrfix/undefined/<n>` and one stripped only the prefix,
    // keeping the agent number. Both produce a real branch under an id no other agent shares, which is outside the
    // pattern teardown can derive for the matching `worktree-<run-id>-<n>` ref.
    const { pinToBase } = await internals({});
    const prompt = pinToBase(HEAD, '0', 'stop.');

    // Two substitutions rather than a backreference: this script is compiled with `new Function`, so it runs sloppy-mode
    // where a `'\1'` in a single-quoted JS string is a legacy octal escape and would ship a literal U+0001 to the agent.
    expect(prompt).toContain("sed -E 's/^worktree-//; s/-[0-9]+$//'");
    expect(prompt).not.toContain('\u0001');
  });

  it('tells an agent whose derivation failed to decline rather than name a branch it never read', async () => {
    // Declining is the safe direction: a fix is lost, but no branch is created that teardown cannot reach.
    const { pinToBase } = await internals({});

    expect(pinToBase(HEAD, '0', 'stop.')).toContain('do not guess a placeholder');
  });
});
