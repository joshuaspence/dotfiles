/**
 * Finding identity: the name a defect keeps across invocations.
 *
 * Everything else in this suite is about one run. This is about the two things that outlive one: the ledger the wrapper
 * persists between invocations, and the `Repo-Review-Finding:` trailer on a fix commit. Both are keyed by a fingerprint,
 * and both break in a way no run can detect if it is not stable — a fingerprint that drifts makes the round the wrapper
 * just paid for look entirely new, and orphans every fix branch already cut.
 *
 * Two rules, and they pull against each other. It must ignore everything about a finding that changes while the defect
 * does not — the line it was cited at, the numbers quoted in its description, the severity a second validator judged it
 * at, the sites a merge absorbed into it — or a settled finding is re-reported as new in every later round. And it must
 * distinguish two genuinely different defects, or the second one is silently suppressed for good, which is the failure
 * that never shows up in a report. So each of the two `describe` blocks below is one half of that, asserted field by
 * field.
 *
 * What it deliberately does *not* do is decide that two reviewers describing one defect in different words are
 * describing one defect. That is the dedupe agent's job, it needs to read code to do it, and no hash will ever do it.
 * `dedupe.test.js` owns that contract; nothing here overlaps it.
 */

import { describe, expect, it } from 'vitest';

import { internals, issue, runReview } from './scenario.js';

const { fingerprint, fingerprintKey, withFingerprint } = await internals();

// Asserted through the key as well as the hash. Two hashes disagreeing says only "expected 5ad0690d… to be 8ac940f0…",
// which does not say *which* field disagreed — and the key is exactly where that answer is. Checking both also pins the
// normalisation independently of the mixing, so a change to one is not free to be excused by the other.
const expectSameFinding = (left, right) => {
  expect(fingerprintKey(left)).toBe(fingerprintKey(right));
  expect(fingerprint(left)).toBe(fingerprint(right));
};

const expectDifferentFindings = (left, right) => {
  expect(fingerprintKey(left)).not.toBe(fingerprintKey(right));
  expect(fingerprint(left)).not.toBe(fingerprint(right));
};

const HEX16 = /^[0-9a-f]{16}$/;

describe('what a fingerprint ignores', () => {
  it('the line a finding was cited at', () => {
    // The whole reason `lines` is out. An unrelated edit above a defect moves it without changing it, and an identity
    // that moved with it would report the same defect as new in every round after the first commit to that file.
    expectSameFinding(issue({ lines: '132' }), issue({ lines: '900-914' }));
  });

  it('the numbers quoted in a description', () => {
    // Descriptions quote line numbers, counts and offsets, so stripping `lines` alone would not have been enough.
    // Digits are dropped rather than replaced by a placeholder, which is what makes these two one finding rather than
    // two findings that merely agree on their shape.
    expectSameFinding(
      issue({ description: 'the retry loop at line 40 runs 3 times' }),
      issue({ description: 'the retry loop at line 88 runs 5 times' }),
    );
  });

  it('two distinct defects that differ only in a number — the accepted cost of that', () => {
    // The other side of the same rule, asserted so it stays a decision rather than a surprise: two genuinely different
    // defects in one file, under one category, whose descriptions differ *only* in a digit are treated as one, and the
    // second is suppressed. Judged the better trade, because line numbers move constantly and counts like this almost
    // never distinguish a defect on their own.
    expectSameFinding(issue({ description: 'retry 1 is unbounded' }), issue({ description: 'retry 2 is unbounded' }));
  });

  it('the severity a validator judged it at', () => {
    // A finding re-reported as `high` rather than `medium` is the same defect differently judged. It is also what a
    // merge writes: `mergeIssueGroups` promotes a survivor's severity to the highest in its group.
    expectSameFinding(issue({ severity: 'medium' }), issue({ severity: 'critical' }));
  });

  it('the sites a merge absorbed into it', () => {
    // `mergeIssueGroups` *appends* to `otherSites` at the moment a duplicate is absorbed. Including it would change a
    // survivor's identity at precisely that moment — the one moment the ledger has to keep recognising it, since the
    // absorbing finding is the one the earlier round persisted.
    expectSameFinding(issue({}), issue({ otherSites: ['core/frame.py:44', 'core/frame.py:51'] }));
  });

  it('a field it has never heard of', () => {
    // Three fields participate and the rest are along for the ride. Asserted because every phase adds something to a
    // finding on its way through — marks, reviewer keys, whatever a later phase needs — and any of those silently
    // joining the identity is the drift this file exists to prevent.
    expectSameFinding(issue({}), issue({ reason: 'entirely different reasoning', confidence: 'low' }));
  });

  it('the case, spacing and punctuation of a description', () => {
    // So that no punctuation choice is load-bearing: `parse_frame`, `parse frame` and `parse-frame` are one name, and a
    // reviewer that capitalised its sentence has not found a second defect.
    expectSameFinding(
      issue({ description: 'parse_frame drops the length prefix' }),
      issue({ description: '  Parse frame — drops, the length  prefix!  ' }),
    );
  });

  it('the case of a category, and a leading `./` on a file', () => {
    // Both are shapes the same value arrives in from more than one direction: `category` is stamped by the script from
    // its own roster but read back out of the wrapper's JSON, and a path is written `./src/a.ts` about as often as
    // `src/a.ts`. Neither difference is a different finding.
    expectSameFinding(issue({ category: 'bug' }), issue({ category: '  BUG ' }));
    expectSameFinding(issue({ file: 'src/a.ts' }), issue({ file: ' ./src/a.ts ' }));
  });

  it('a fingerprint the finding is already carrying', () => {
    // `withFingerprint` runs on every finding the wrapper hands back, deliberately recomputing rather than trusting what
    // was stored. That is only safe if it is idempotent — otherwise the second round through the ledger renames
    // everything — and it is idempotent only because the stamped field is not itself one of the three that are read.
    const stamped = withFingerprint(issue({}));

    expect(withFingerprint(stamped)).toEqual(stamped);
    expect(fingerprint({ ...stamped, fingerprint: 'deadbeefdeadbeef' })).toBe(stamped.fingerprint);
  });

  it('leaves the rest of the finding exactly as it was', () => {
    // Stamping is additive. A phase downstream reads `file`, `lines`, `severity` and `otherSites` off these objects, and
    // several of the suite's assertions compare a returned finding against the fixture it came from.
    const original = issue({ otherSites: ['src/b.ts:4'] });
    const { fingerprint: _stamp, ...rest } = withFingerprint(original);

    expect(rest).toEqual(original);
  });
});

describe('what a fingerprint distinguishes', () => {
  it('the category that found it', () => {
    // Two reviewers can cite one line for two unrelated reasons — a `bug` and a `consistency` complaint about the same
    // call — and collapsing them would let whichever ran first suppress the other permanently.
    expectDifferentFindings(issue({ category: 'bug' }), issue({ category: 'security' }));
  });

  it('the file it is in', () => {
    expectDifferentFindings(issue({ file: 'core/wire.py' }), issue({ file: 'core/frame.py' }));
  });

  it('the case of that file, because a path is case-sensitive', () => {
    // `file` is the one field not lowercased. On the filesystems this runs against these are two files, and folding them
    // together would suppress a real finding in whichever one was reported second.
    expectDifferentFindings(issue({ file: 'Core/Wire.py' }), issue({ file: 'core/wire.py' }));
  });

  it('a genuinely different description', () => {
    expectDifferentFindings(
      issue({ description: 'unchecked frame length' }),
      issue({ description: 'partial read treated as EOF' }),
    );
  });

  it('two descriptions in a language with no ASCII letters', () => {
    // The `\p{L}` guard. Under `[^a-z]` these two descriptions normalise to nothing at all, which would make *every*
    // finding in one file under one category the same finding — a whole review collapsing to one entry, for a repository
    // whose reviewers answered in the language its comments are written in.
    expectDifferentFindings(
      issue({ file: 'core/wire.py', description: 'кадр не проверяется' }),
      issue({ file: 'core/wire.py', description: 'частичное чтение' }),
    );
  });

  it('a file and a description that could be concatenated the other way round', () => {
    // Why the fields are joined on NUL rather than on a space. A space is a character two of the three fields can hold,
    // so under a space separator these two keys are the same string. NUL is the one byte a POSIX path cannot contain,
    // and the description is normalised down to letters and spaces, so neither field can forge the separator.
    expectDifferentFindings(
      issue({ file: 'src/a b.ts', description: 'c' }),
      issue({ file: 'src/a.ts', description: 'b c' }),
    );
  });
});

// --- The generated corpus --------------------------------------------------------------------------------------------
// A base-26 alphabetic counter. A generated corpus has to vary without using digits, which the normalisation strips —
// numbering the descriptions would make all 2000 of them identical and the collision assertion below would fail for a
// reason that has nothing to do with the hash.
const letters = (n) => {
  let out = '';
  let rest = n;

  do {
    out = String.fromCharCode(97 + (rest % 26)) + out;
    rest = Math.floor(rest / 26) - 1;
  } while (rest >= 0);

  return out;
};

const CORPUS = Array.from({ length: 40 }, (_unit, file) =>
  Array.from({ length: 50 }, (_finding, description) =>
    issue({ file: `src/${letters(file)}.ts`, description: `defect ${letters(description)}` }),
  ),
).flat();

describe('the shape of a fingerprint', () => {
  it('is sixteen lowercase hex characters', () => {
    // Fixed width matters because it goes in a commit trailer the wrapper greps for and a JSON key it compares by
    // equality. Both halves are zero-padded, so a hash whose leading bits happen to be zero is still 16 characters.
    expect(fingerprint(issue({}))).toMatch(HEX16);
    expect(CORPUS.every((finding) => HEX16.test(fingerprint(finding)))).toBe(true);
  });

  it('answers for a finding with nothing on it', () => {
    // The three fields are read off untrusted input — a reviewer's response, and a ledger the user may have edited — so
    // a missing or non-string field must produce a key rather than a throw. This runs before any validation and there is
    // nothing above it to catch a throw: `withFingerprint` is applied while the findings are being read in.
    expect(() => fingerprint({})).not.toThrow();
    expect(() => fingerprint(null)).not.toThrow();
    expect(() => fingerprint({ category: 7, file: null, description: ['a'] })).not.toThrow();
    expect(fingerprint({})).toMatch(HEX16);
  });

  it('names 2000 distinct findings 2000 different things', () => {
    // Not a claim about the mixing quality so much as a guard against a fingerprint that stopped reading one of its
    // fields: dropping `file` leaves 50 distinct values here, dropping `description` leaves 40.
    expect(new Set(CORPUS.map(fingerprintKey)).size).toBe(CORPUS.length);
    expect(new Set(CORPUS.map(fingerprint)).size).toBe(CORPUS.length);
  });

  it('carries two different accumulators, not one twice', () => {
    // The width is the entire reason there are two. A single 32-bit hash collides at roughly one in ten thousand for a
    // few hundred findings, and a collision here does not read as a wrong number in a report — two distinct defects
    // become one ledger entry and the second is suppressed permanently. A hash that emitted one accumulator twice would
    // pass every other assertion in this file while being 32 bits wide.
    const halves = CORPUS.map((finding) => {
      const value = fingerprint(finding);

      return [value.slice(0, 8), value.slice(8)];
    });

    expect(halves.filter(([left, right]) => left === right)).toEqual([]);
  });
});

describe('the format itself', () => {
  it('is pinned, because changing it orphans every ledger entry and every branch already cut', () => {
    // The one place in the suite that asserts a literal fingerprint, and the only place that should: everywhere else
    // borrows `withFingerprint` from the script so that changing the hash does not mean editing expected values in five
    // files. Here it deliberately does mean editing one, because this is a persistence format. A run whose fingerprints
    // moved sees an untouched ledger as an entirely new review — every finding re-reported, every fix re-offered — and
    // can no longer match `Repo-Review-Finding:` in a branch cut by an earlier run. Neither failure is visible in a
    // report, so nothing else would catch it. Changing these values is allowed; doing it by accident is not.
    expect(
      fingerprint(issue({ category: 'bug', file: 'core/wire.py', description: 'unchecked frame length at line 132' })),
    ).toBe('5ad0690d2af6509d');
    expect(
      fingerprint(
        issue({ category: 'security', file: 'src/auth/token.ts', description: 'JWT signature is never verified' }),
      ),
    ).toBe('8ac940f0059e7bdc');

    // The degenerate key — three empty fields — pinned so that a missing field stays the empty string rather than
    // becoming the text `undefined`, which would give every malformed finding a shared identity with no marker saying so.
    expect(fingerprint({})).toBe('117697cd00596a45');
  });
});

describe('every finding a run reports', () => {
  it('comes back named', async () => {
    // Stamped on ingestion rather than on the way out, so the value a fixer is told to commit and the value the wrapper
    // persists are the same one by construction rather than by two call sites agreeing.
    const run = await runReview({
      issues: [issue({ file: 'src/a.ts' }), issue({ file: 'src/b.ts', description: 'a second finding' })],
    });

    expect(run.result.findings).toHaveLength(2);

    for (const finding of run.result.findings) {
      expect(finding.fingerprint).toMatch(HEX16);
      expect(finding.fingerprint).toBe(fingerprint(finding));
    }
  });

  it('is what the wrapper writes to the ledger, so the next command can ask about it by name', async () => {
    // The ledger is the whole interface between this command and `/repo-review-fix`, and the fingerprint is the only
    // field in it that survives a finding's position changing between rounds. Every finding reaching the caller with one
    // is what makes the ledger addressable at all.
    const run = await runReview({ issues: [issue({ file: 'src/a.ts' }), issue({ file: 'src/b.ts' })] });

    expect(run.result.findings.map((finding) => finding.fingerprint)).toEqual(
      run.result.findings.map(fingerprint),
    );
    expect(new Set(run.result.findings.map((finding) => finding.fingerprint)).size).toBe(2);
  });
});
