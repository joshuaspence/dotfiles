/**
 * The architecture gate: when the one whole-repository Opus agent runs, and what is recorded when it does not.
 *
 * There are two reasons it can be skipped and they are not the same kind of thing, which is most of what this file is
 * about. A scope of one or two files has no repository-level structure to assess, so the agent is skipped and the skip is
 * a **gap** — coverage the round does not have, and an empty `findings` list reads as "architecture: clean" without it. A
 * commit whose structure has already been reviewed is skipped for the opposite reason: the coverage *is* there, carried
 * in the ledger, so that skip is narration rather than a caveat. Report the second as a gap and every looped review would
 * grow a false coverage warning per round; report neither and a review of two files would claim a structural audit it
 * never ran.
 *
 * The epoch record is what tells the two apart, and it round-trips through the wrapper — so both directions are pinned
 * here: what the script does with a record it is handed, and what record it hands back. The wrapper's half of that
 * contract, the ledger key, is prose in `exact_commands/repo-review.md` and is pinned by `commands.test.js` only as far
 * as prose can be.
 */

import { describe, expect, it } from 'vitest';

import { runWorkflow } from '../harness.js';
import { HEAD, issue, reviewScenario, runReview, SCRIPT } from './scenario.js';

// One agent where there were three, one per lens. Read as a constant rather than written as `1` so that the count and the
// reason for it stay attached: three blind agents over the same tree reported the same structural defect three ways.
const AGENTS = 1;
const SKIPPED = 'Architecture lenses not run';

// A commit that is not the one the survey reports, i.e. the tree having moved under the ledger.
const MOVED = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0';

// A scope wide enough to clear the file-count floor, so that the only thing deciding the gate is the epoch.
const wide = { name: 'core', summary: 'the protocol', paths: ['core/wire.py', 'core/frame.py', 'core/codec.py'] };

// A round handed an epoch record, on a scope that would otherwise run the agent.
const withEpoch = (architectureReview, args = {}) =>
  runReview({
    issues: [issue({ file: 'core/wire.py' })],
    units: [wide],
    args: { architectureReview, ...args },
  });

describe('the file-count floor', () => {
  it('skips the agent on a scope of one file, and records the skip', async () => {
    const run = await runReview({
      issues: [issue({ file: 'core/wire.py' })],
      units: [{ name: 'core', summary: 'the protocol', paths: ['core/wire.py'] }],
    });

    expect(run.called(/^review:arch/)).toEqual([]);
    expect(run.result.gaps.join(' ')).toContain(`${SKIPPED}: only 1 file(s) in scope`);
  });

  it('skips the agent on a scope of two files, and records the skip', async () => {
    const run = await runReview({
      issues: [issue({ file: 'core/wire.py' })],
      units: [{ name: 'core', summary: 'the protocol', paths: ['core/wire.py', 'core/frame.py'] }],
    });

    expect(run.called(/^review:arch/)).toEqual([]);
    expect(run.result.gaps.join(' ')).toContain(`${SKIPPED}: only 2 file(s) in scope`);
  });

  it('runs the agent when the partitioner returns a directory per unit', async () => {
    // The regression: a unit's `paths` are not required to be files, so two directory strings covering a whole
    // repository counted as two files and the structural review was skipped as "too small" — on thousands of files.
    const run = await runReview({
      issues: [issue({ file: 'core/wire.py' })],
      units: [
        { name: 'core', summary: 'the protocol', paths: ['core'] },
        { name: 'api', summary: 'the request surface', paths: ['api/'] },
      ],
    });

    expect(run.called(/^review:arch/)).toHaveLength(AGENTS);
    expect(run.result.gaps.join(' ')).not.toContain(SKIPPED);
  });

  it('runs the agent once one unit covers a directory, however many files the others name', async () => {
    // One unknown-sized path makes the whole scope unknown-sized: the two files beside it are a floor, not a count.
    const run = await runReview({
      issues: [issue({ file: 'core/wire.py' })],
      units: [{ name: 'core', summary: 'the protocol', paths: ['core/wire.py', 'lib'] }],
    });

    expect(run.called(/^review:arch/)).toHaveLength(AGENTS);
    expect(run.result.gaps.join(' ')).not.toContain(SKIPPED);
  });

  it('runs the agent when a unit names no paths at all', async () => {
    // No paths means a file count of 0, which reads as unknown scope rather than as the smallest one there is.
    const run = await runReview({
      issues: [issue({ file: 'core/wire.py' })],
      units: [{ name: 'core', summary: 'the protocol', paths: [] }],
    });

    expect(run.called(/^review:arch/)).toHaveLength(AGENTS);
    expect(run.result.gaps.join(' ')).not.toContain(SKIPPED);
  });

  it('runs the agent on a wide scope of plain files', async () => {
    const run = await runReview({ issues: [issue({ file: 'core/wire.py' })], units: [wide] });

    expect(run.called(/^review:arch/)).toHaveLength(AGENTS);
    expect(run.result.gaps.join(' ')).not.toContain(SKIPPED);
  });

  it('aborts before the gate when the partition agent returns an empty units array', async () => {
    // Partition validation catches empty arrays upstream of the gate — the gate itself only runs when units have
    // already been validated. This test verifies the empty array error path is handled correctly.
    const run = await runReview({ issues: [issue({ file: 'core/wire.py' })], units: [] });

    expect(run.called(/^review:arch/)).toEqual([]);
    expect(run.result.gaps.join(' ')).toContain('Partition agent did not return usable units');
  });

  it('aborts before the gate when the partition agent returns null units', async () => {
    // The partition validation also catches null units. A minimal custom agent is needed since the fixture's default
    // handling falls back to a valid roster when units is null.
    const run = await runWorkflow({
      scriptPath: SCRIPT,
      args: { validators: 1, reviewers: 1 },
      agent: (call) => {
        if (call.label === 'survey') {
          return {
            languages: ['Python'],
            tooling: 'pytest',
            entryPoints: ['core/wire.py'],
            structure: [{ path: 'core', fileCount: 1 }],
            inScopeFileCount: 1,
            headSha: HEAD,
          };
        }
        if (call.label === 'claude-md-scan') {
          return { paths: ['CLAUDE.md'] };
        }
        if (call.label === 'partition') {
          return { units: null, exclusions: [] };
        }
        return null;
      },
    });

    expect(run.called(/^review:arch/)).toEqual([]);
    expect(run.result.gaps.join(' ')).toContain('Partition agent did not return usable units');
  });

  it('aborts before the gate when the partition agent omits the units key', async () => {
    // The partition validation also catches when units is undefined (omitted from the return object). Like the null case,
    // this requires a custom agent to bypass the fixture's default roster.
    const run = await runWorkflow({
      scriptPath: SCRIPT,
      args: { validators: 1, reviewers: 1 },
      agent: (call) => {
        if (call.label === 'survey') {
          return {
            languages: ['Python'],
            tooling: 'pytest',
            entryPoints: ['core/wire.py'],
            structure: [{ path: 'core', fileCount: 1 }],
            inScopeFileCount: 1,
            headSha: HEAD,
          };
        }
        if (call.label === 'claude-md-scan') {
          return { paths: ['CLAUDE.md'] };
        }
        if (call.label === 'partition') {
          return { exclusions: [] };
        }
        return null;
      },
    });

    expect(run.called(/^review:arch/)).toEqual([]);
    expect(run.result.gaps.join(' ')).toContain('Partition agent did not return usable units');
  });
});

describe('the epoch', () => {
  it('does not re-run the agent on a commit whose structure was already reviewed', async () => {
    // The saving itself. Repository structure cannot change between rounds of a read-only review, so rounds 2 through n
    // spent the run's most expensive agent re-reading a byte-identical tree.
    const run = await withEpoch({ commit: HEAD, scope: [] }, { round: 2 });

    expect(run.called(/^review:arch/)).toEqual([]);

    // And the skip is *not* a gap: the coverage exists and is carried in the ledger, so the round is still entitled to
    // report architecture as reviewed. A gap here would put a false coverage warning on every round of every loop.
    expect(run.result.gaps.join(' ')).not.toContain(SKIPPED);
    expect(run.result.gaps.join(' ')).not.toContain('rchitecture');
    expect(run.logged('Architecture already reviewed')).toHaveLength(1);
  });

  it('runs the agent again when the tree has moved under the record', async () => {
    // Keyed on the commit and not on the round number, so a looped review of a branch someone is still pushing to
    // re-assesses the structure it is actually looking at.
    const run = await withEpoch({ commit: MOVED, scope: [] }, { round: 2 });

    expect(run.called(/^review:arch/)).toHaveLength(AGENTS);
  });

  it('runs the agent on a cold start, and on a record it cannot read', async () => {
    // No record is the ordinary first round. A malformed one is the wrapper's JSON round trip having damaged it, and it
    // has to read as *no* record: the alternative is a review that skips its structural pass on the strength of a value
    // it could not parse.
    for (const record of [undefined, null, 'HEAD', { commit: 'cd976db' }, { commit: 42 }, {}]) {
      const run = await withEpoch(record, { round: 2 });

      expect(run.called(/^review:arch/), `record: ${JSON.stringify(record)}`).toHaveLength(AGENTS);
    }
  });

  it('runs the agent when the record covers less of the tree than this round asks about', async () => {
    // The agent examines the whole repository but reports only on the requested subtrees, so a record made under
    // `--path core` does not stand for a whole-repository round: skipping on it would leave everything outside `core`
    // structurally unreviewed while the ledger read as though the commit had been covered. A record for a subtree this
    // round is not even asking about does not cover it either.
    for (const scope of [['core'], ['lib']]) {
      const run = await withEpoch({ commit: HEAD, scope }, { round: 2 });

      expect(run.called(/^review:arch/), `scope: ${JSON.stringify(scope)}`).toHaveLength(AGENTS);
    }
  });

  it('skips the agent when the record covers more of the tree than this round asks about', async () => {
    // Narrowing is the safe direction: a whole-repository record already contains everything a subtree round would be
    // told about, and so does a record for a *parent* of every subtree asked for now.
    //
    // A directory per unit, and a `--path` that is a strict child of the record's scope, for two separate reasons. The
    // directory keeps the file count unknown, so the floor cannot be what does the skipping — written first as three
    // named files under `--path core/proto`, this narrowed to one file and passed for the wrong reason entirely, which is
    // why the gap assertion below is here and not merely implied. And the child has to be strict: with the record's scope
    // equal to the round's, containment holds in both directions and a comparison made the wrong way round still passes.
    for (const scope of [[], ['core']]) {
      const run = await runReview({
        issues: [issue({ file: 'core/proto/wire.py' })],
        units: [{ name: 'proto', summary: 'the protocol', paths: ['core/proto'] }],
        args: { round: 2, paths: ['core/proto'], architectureReview: { commit: HEAD, scope } },
      });

      const where = `scope: ${JSON.stringify(scope)}`;

      expect(run.result.gaps.join(' '), where).not.toContain(SKIPPED);
      expect(run.called(/^review:arch/), where).toEqual([]);
    }
  });

  it('skips the agent on a record whose commit differs only in case', async () => {
    // `git rev-parse` prints lower case and the record is canonicalised to it on both sides, so a differently-cased
    // record is the same commit rather than a permanent miss — which is what it would be if the comparison were made
    // against the string as it arrived, re-running the agent every round forever.
    const run = await withEpoch({ commit: HEAD.toUpperCase(), scope: [] }, { round: 2 });

    expect(run.called(/^review:arch/)).toEqual([]);
  });

  it('runs the agent when the round has no commit to compare against', async () => {
    // A survey that returned no usable `HEAD` leaves the round unable to say whether the tree it is reading is the one in
    // the record. Compared naively, a null record and a null `HEAD` are equal, and the structural review would be skipped
    // on the strength of two absent values agreeing.
    const run = await runReview({
      issues: [issue({ file: 'core/wire.py' })],
      units: [wide],
      survey: { headSha: null },
      args: { round: 2 },
    });

    expect(run.called(/^review:arch/)).toHaveLength(AGENTS);
    expect(run.result.architectureReview).toEqual({ commit: null, scope: [] });
  });

  it('stamps the record with the reviewed commit and scope when the agent returns', async () => {
    // What the wrapper stores, and the other half of the round trip: a round that skips on its own record must produce
    // the same record again, or the epoch would last exactly one round.
    const first = await runReview({ issues: [issue({ file: 'core/wire.py' })], units: [wide] });

    expect(first.result.architectureReview).toEqual({ commit: HEAD, scope: [] });

    const second = await withEpoch(first.result.architectureReview, { round: 2 });

    expect(second.called(/^review:arch/)).toEqual([]);
    expect(second.result.architectureReview).toEqual({ commit: HEAD, scope: [] });
  });

  it('does not stamp a commit the agent was never run for', async () => {
    // A round the floor skipped has learned nothing about this commit's structure, so it hands the incoming record back
    // untouched. Stamping here is the defect that matters most in this file: it would tell every later round the
    // structural review was done, and a two-file scope would suppress the audit of the repository it grows into.
    const run = await runReview({
      issues: [issue({ file: 'core/wire.py' })],
      units: [{ name: 'core', summary: 'the protocol', paths: ['core/wire.py'] }],
      args: { round: 2, architectureReview: { commit: MOVED, scope: [] } },
    });

    expect(run.result.gaps.join(' ')).toContain(SKIPPED);
    expect(run.result.architectureReview).toEqual({ commit: MOVED, scope: [] });
  });

  it('does not stamp a commit whose agent stalled', async () => {
    // The same rule for the other way of not getting an answer, and the reason the script tracks *which* reviewers
    // failed rather than only how many: an agent that ran and died has produced no structural review either, so the next
    // round must run it again.
    // Composed from `reviewScenario` directly, rather than through `runReview`, because the drop is keyed off the label
    // of the call rather than off a finding — which is what "the architecture agent died" means and what no override can
    // say. The same construction `review-gate.test.js` uses for a dropped unit reviewer.
    const scenario = reviewScenario({ issues: [issue({ file: 'core/wire.py' })], units: [wide] });
    const run = await runWorkflow({
      scriptPath: SCRIPT,
      args: { round: 2, architectureReview: { commit: MOVED, scope: [] } },
      agent: (call) => (call.label.startsWith('review:arch') ? null : scenario.agent(call)),
    });

    expect(run.result.gaps.join(' ')).toContain('Reviewer did not complete: review:arch');
    expect(run.result.architectureReview).toEqual({ commit: MOVED, scope: [] });
  });
});
