/**
 * The label grammar every per-finding agent is keyed off, and the fixture's restatement of it.
 *
 * A label is the only thing a fake agent has to tell it which finding it is being asked about and which attempt or vote
 * it is, so `scenario.js` parses one with a regex — necessarily a *second* statement of what the three builders here
 * emit. When the two drift, nothing in this suite fails at the seam: `parseLabel` returns `{ kind: '<the whole label>' }`,
 * the scenario's catch-all answers `null`, and the run reports agents that never returned. Every assertion in every other
 * file then fails at once, on figures that say nothing about labels. So the two are asserted against each other here.
 *
 * The label also has a second reader — the `/workflows` progress tree, where it is what a user watching a long fix run
 * sees. That is why the segments are omitted rather than zeroed when there is only one of them: `attempt 1` on a fix that
 * was never revised, and `vote 1/1` under the default `--reviewers 1`, is a column of constants.
 */

import { describe, expect, it } from 'vitest';

import { internals, issue, parseLabel } from './scenario.js';

describe('a per-finding label', () => {
  it('round-trips through the parser every scenario reads it with', async () => {
    const { attemptTag, findingTag, voteTag } = await internals({});
    const tag = findingTag(issue({ category: 'bug' }), 3);

    expect(parseLabel(`fix:${tag}`)).toEqual({ kind: 'fix', category: 'bug', idx: 3, attempt: 0, vote: 0 });

    expect(parseLabel(`revise:${tag}${attemptTag(1)}`)).toEqual({
      kind: 'revise',
      category: 'bug',
      idx: 3,
      attempt: 1,
      vote: 0,
    });

    expect(parseLabel(`review-fix:${tag}${voteTag(2, 3)}`)).toEqual({
      kind: 'review-fix',
      category: 'bug',
      idx: 3,
      attempt: 0,
      vote: 2,
    });
  });

  it('carries no attempt or vote segment when there is only one of either', async () => {
    // The defaults the parser fills in for an absent segment have to be the ones the absence means. Read the other way —
    // an omitted `attempt` parsed as anything but the original attempt — a test overriding `fix` by attempt number would
    // answer the wrong branch of its own override.
    const { attemptTag, voteTag } = await internals({});

    expect(attemptTag(0)).toBe('');
    expect(voteTag(0, 1)).toBe('');
    expect(parseLabel('fix:bug#0')).toMatchObject({ attempt: 0, vote: 0 });
  });

  it('numbers attempts and votes from one, since a user reads them', async () => {
    // The parser subtracts the one back off. Emitting zero-based numbers instead would be invisible here and wrong in
    // `/workflows`, where `attempt 0` reads as a run that has not started.
    const { attemptTag, voteTag } = await internals({});

    expect(attemptTag(1)).toBe(' attempt 2');
    expect(voteTag(0, 2)).toBe(' vote 1/2');
  });

  it('leaves a label that is not per-finding whole, for the fixture to fail on rather than misroute', async () => {
    // The survey has no finding, so it falls through to `{ kind: '<label>' }` and matches the scenario's `survey` case
    // by name. Anything else lands in the catch-all, which is what turns a phase the fixture has not been taught about
    // into a named failure instead of an agent that quietly returned null.
    expect(parseLabel('survey')).toEqual({ kind: 'survey' });
    expect(parseLabel('fix:bug#1 round 2/4')).toEqual({ kind: 'fix:bug#1 round 2/4' });
  });
});
