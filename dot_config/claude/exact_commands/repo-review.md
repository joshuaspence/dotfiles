---
name: Repo Review
description: Review an entire repository
argument-hint: >-
  [--effort <low|medium|high|xhigh|max>]
  [--fix]
  [--output <file>]
  [--partitions <n|auto>]
  [--reviewers <n>]
  [--rounds <n>]
  [--validators <n|auto>]
  [path ...]
allowed-tools:
  - Bash(git branch --delete --force:*)
  - Bash(git remote get-url:*)
  - Bash(git rev-parse:*)
  - Bash(git worktree list:*)
  - Bash(git worktree prune:*)
  - Bash(git worktree remove:*)
  - Read
  - Workflow
  - Write
---

Provide a code review for an entire repository.

The review runs as a committed **workflow** — `repo-review`, referenced by name — which fans it out across subagents
(survey → partition → review → dedup → validate) and returns validated findings. This command is a thin wrapper: parse
the arguments below, run that workflow via the `Workflow` tool, and format what it returns. The algorithm itself — the
phases, the per-step model tiers, the effort cap, the strict-majority rule, and the reviewer instructions — lives in the
script; do not re-implement it here, and do not launch review subagents any other way.

## Parse arguments

The arguments to this command are: `$ARGUMENTS`. Parse them as follows.

**Invariant — account for every token.** Every token in `$ARGUMENTS` is exactly one of three things: a `--flag`, a value
belonging to the `--flag` immediately before it, or a `path`. There is no fourth category and there is no token you
may ignore. So: if a token is not a flag and not a preceding flag's value, it **is** a path — carry it through to
`args`, and carry through **every** such token rather than only the first. Dropping one is not a harmless omission: drop
the only path and the review silently widens from one subtree to the entire repository; drop one of several and it
silently narrows, so a subtree the user asked about is never opened. Either way every phase then behaves correctly for
that wrong scope, and nothing downstream can detect the mistake. Adding a flag never removes a path: the paths are
independent of `--fix`, `--output`, and every other flag, and combining them does not make any of them optional.

Paths are not required to be contiguous or to come last — `/repo-review src --fix lib` supplies two of them — so
collect each one as you scan the tokens instead of expecting a single run at either end.

- Bare `path` arguments are optional and scope the review to the subtrees they name. Any number may be given: none
  (review the whole repository), one, or several. When given they apply throughout the script (survey, partition, and
  the per-unit reviewers cover only those subtrees; the architecture lenses still read the whole repo but report only
  defects involving them). Pass them as `paths`, an **array of strings** in the order they appeared, e.g.
  `["src", "lib"]` — and use the array form even for a single path (`["src"]`). Omit the key entirely when no path was
  given; the script then reviews the whole repository. Each path may name a directory or a single file, and the two may
  be mixed. The script drops blank entries and collapses exact duplicates, so `src src` scopes to `src` once; it cannot
  tell that `src` and `src/a.js` overlap, though, and passing both merely makes the narrower one redundant — pass what
  the user wrote and do not try to prune the list yourself.
- `--effort <low|medium|high|xhigh|max>` sets the requested reasoning effort for the workflow's subagents. If omitted,
  the script uses `high`. Reject any other value and stop with an error rather than guessing. When given, pass it
  through unchanged — the script itself caps the high-fan-out agents at `xhigh` (see [Notes](#notes)); you do not clamp
  it here.
- `--partitions <n|auto>` sets how many coherent review units the repository is partitioned into. Must be a positive
  integer or `auto`; reject any other value and stop with an error rather than guessing. If omitted, the script defaults
  it to `auto`, which lets the partitioner choose within a range the script scales to how many files are actually in
  scope — so a narrow set of paths does not fan out as though it were the whole repository. Pass an explicit `n` to
  override that sizing in either direction.
- `--validators <n|auto>` sets how many independent validators run per issue. Must be a positive integer or `auto`;
  reject any other value and stop with an error rather than guessing. If omitted, the script defaults it to `1` — do not
  pass `auto` yourself; `auto` applies only when the user explicitly asks for it. A fixed `n > 1` keeps an issue only on
  a strict majority of its validators (≥2 of 3, ≥3 of 5); `auto` scales the count by risk (more for bugs, security,
  consistency, and architecture; a single validator for code-quality, test-critique, and `CLAUDE.md`). The script
  applies this rule — you only pass the value through.

  `--partitions` and `--validators` are orthogonal to `--effort`: they scale how many agents run and how many times
  findings are challenged, whereas `--effort` scales how hard each individual agent thinks.

- `--rounds <n>` sets how many review rounds to run at most. Must be a positive integer; reject any other value
  (`--rounds 0`, `--rounds 2.5`, `--rounds auto`) and stop with an error rather than guessing. If omitted, run **one**
  round. Unlike every other numeric flag, this one is not passed to the script and has no key in `args`: the script runs
  exactly one round per invocation, and `--rounds` is *your* loop bound — see
  [Run the rounds](#run-the-rounds) for the loop it governs.

  It counts the rounds run **in this invocation**, not the round number the review has reached. Those are different
  numbers now that [the ledger](#the-ledger) carries the count across invocations: running `/repo-review --rounds 2`
  three times runs rounds 1–2, then 3–4, then 5–6, stopping on the second round of each. So the cap bounds what the user
  is spending right now, which is the thing they were asking about — a cap on the absolute number would make the fourth
  invocation of `--rounds 2` do nothing at all and report that it had hit its limit.

  It is a third, orthogonal axis: `--effort` scales how hard
  each agent thinks, `--partitions`/`--validators` scale how many agents run and how often findings are challenged, and
  `--rounds` scales how many times the whole review repeats.

  It replaced a `--loop [<max-rounds>]` whose value was optional, which is worth knowing because the shape was the
  problem. An optional value cannot be told from a `path` by position, so it needed a rule of its own — consume the next
  token only if it begins with a digit — which then made a directory named `2024` unpassable after a bare `--loop`, and
  made `true` and `3` both legal values of one key. A mandatory value removes all of that: `--rounds` parses exactly like
  `--partitions`.

- `--fix` (boolean, no value) makes the review **act**: after validation, the script runs its Fix and Review Fix phases
  — one isolated agent per validated finding attempts a clean, verified fix and commits it on a branch of its own, and
  those fixes are independently reviewed (see `--reviewers`) — and returns a per-finding outcome plus the branches worth
  keeping. This command **lands nothing**: it verifies those branches against git, reports them for you to review and
  merge yourself, and tears down only the sandboxes that hold no work (see
  [Report the fix branches](#report-the-fix-branches)). If omitted, the review is strictly read-only, as before. Pass it
  as `fix`: `true` when present; omit it otherwise. `--fix` is independent of the other flags (it fixes whatever the
  review, at whatever partitions/validators/effort/rounds, validated). Each round fixes only the findings *it* confirmed,
  so a multi-round `--fix` run produces branches as it goes rather than a batch at the end.

- `--reviewers <n>` sets how many independent reviewers judge each fix in the Review Fix phase (only meaningful with
  `--fix`). Must be a non-negative integer; reject any other value and stop with an error rather than guessing. If
  omitted, the script defaults it to `1`. A fix is kept only on a **strict majority** of its reviewers; a rejected fix
  is sent back to the fixer with the objection and re-reviewed, up to an internal revision cap, before being reported
  unfixed. **`--reviewers 0` disables the Review Fix phase entirely** — every fix that verified in its own sandbox is
  then reported as applied without a second opinion on it. Pass it through as `reviewers` when given; omit it otherwise.
  This is to *fixes* what `--validators` is to *findings*.

- `--output <file>` writes the report to that file in addition to the terminal. This command handles it; do **not** pass
  it to the script. It is the only flag you parse and then deliberately withhold — every other flag is either passed
  through or absent — so take care that consuming `--output` and its filename does not also consume a `path`. Its
  filename is the value of the flag before it and is therefore never one of the `paths`, however path-like it looks.

## The ledger

The script reviews one round per invocation and remembers nothing between them. What makes a second invocation cheaper
than a first is a file this command owns: **`.claude/repo-review.json`, at the root of the repository under review** (not
in your config directory). Read it before you build `args`; write it after every round that returns. A round that got
reported and then went unrecorded is a round the next invocation pays for in full and reports as new.

Every finding carries a `fingerprint`: sixteen hex characters the script derives from the finding's category, its file
and its description with every digit stripped. That is the **only** field you may key a finding on. It is stable across
exactly the things that change while the defect does not — the line it was cited at drifting, a second validator judging
its severity differently, a duplicate being absorbed into it — and nothing else in a finding is: positions change every
round, `lines` moves with the file, `severity` and `otherSites` are rewritten by a merge, and a description can be
re-worded by the reviewer that re-reports it.

### The file

```json
{
  "version": 1,
  "updatedAt": "2026-08-30T05:41:00Z",
  "reviewedCommit": "cd976db1f0a94c2f9b7e5d3a8c1e6f40b2d75a93",
  "round": 3,
  "scope": ["src"],
  "exclusions": [{ "path": "vendor", "reason": "third-party code" }],
  "findings": [
    {
      "fingerprint": "5ad0690d2af6509d",
      "description": "unchecked frame length",
      "severity": "high",
      "category": "bug",
      "file": "core/wire.py",
      "lines": "132",
      "otherSites": [],
      "reason": "a length prefix is read but never bounded",
      "firstSeen": { "round": 2, "commit": "a1b2c3d4…" }
    }
  ]
}
```

- `findings` is the last round's `findings` array **verbatim**, entry for entry, with exactly one key added per entry:
  `firstSeen`, holding the `round` and `reviewedCommit` of the round that first reported that fingerprint. Add nothing
  else, and change nothing that was already there: what you store is what the next round is handed back as
  `knownFindings`, and a finding you re-worded is one dedupe can no longer recognise as the same finding.

  `firstSeen` is inert to the script and comes back by itself. A held finding is passed through as the object it arrived
  as, so the key you wrote is on it again in the next round's `findings` — read it from there rather than re-joining by
  fingerprint. Only a finding that is new needs one stamped. The script reads just `category`, `file`, `lines`,
  `description`, `severity` and `otherSites` off a held finding and renders those into the prompts, so a wrapper-owned key
  never reaches an agent; it is also why this is the only key to add, since an unknown one is carried rather than
  validated and a mistake here would be silent.
- `round` is the last round's `round` — the **absolute** count across every invocation, which the next one continues
  from. It is not the number of rounds run today; see `--rounds`.
- `reviewedCommit` is the last round's, so the next report can say how far the checkout has moved since the review.
- `scope` is the `paths` of the invocation that last wrote the file, or `[]` for a whole-repository run.
- `exclusions` is the last round's `exclusions`, **overwritten** rather than accumulated: it describes the partition of
  the scope that was last reviewed, and an older run's exclusions are not true of a different scope.
- `version` is the format version of this file, not of the review: bump it only when the shape above changes in a way an
  older reader would mishandle. It is `1`.

### Reading it

1. `Read` the file. **It not existing is the ordinary case**, not an error: it means a cold start. Say "no previous review
   found" in one line and continue with round 1.
2. If it exists but cannot be parsed as JSON, or `findings` is not an array, report that plainly — naming the file — and
   continue as a cold start. Checked before the version, because an unparseable file has no version to read. You will
   overwrite it at the end of the round, which loses whatever was in it, so the user has to be told before that happens
   rather than after.
3. If `version` is a number **greater than 1**, stop. Do not review and do not overwrite — a newer version of this
   command wrote it, and its findings are not yours to reinterpret or to destroy. Say which version you found, and that
   deleting the file starts a fresh review. This is the one read failure that is not recovered from: every other one
   costs a cold start, and this one would cost somebody else's accumulated review.
4. If `scope` disagrees with this invocation's paths, say so in one line and continue: the script does not scope
   `knownFindings`, so findings held from a wider scope are still passed and still suppressed as already-known, they are
   simply not re-examined this time. A finding out of the current scope is neither re-reported nor dropped.

There is deliberately no `--fresh` flag. Deleting `.claude/repo-review.json` is the documented way to start over, and it
is a thing the user can do without this command's help.

### Writing it

Write the file with `Write` after **each** round, as part of reporting that round and before deciding whether to run
another — same reasoning as reporting the round itself: a round that returned must not be able to be lost by whatever
happens next. Set `round`, `reviewedCommit`, `exclusions` and `findings` from what the round just returned, `scope` from
this invocation's paths, and `updatedAt` to the current time.

A finding that was in the ledger and is **not** in the round's `findings` was absorbed by dedupe as a duplicate of
another finding. Drop it, and let its `firstSeen` go with it — the survivor has its own, and it is the entry the review
now holds.

### What this round actually contributed

Because the ledger gives you the exact set you handed over, you can compute the round's contribution rather than trust a
count: **the findings whose `fingerprint` is not among the fingerprints you passed as `knownFindings`.** Those are the new
ones, and they are what the report should lead with.

That set's size must equal `newFindings`. It is an invariant, not a coincidence — a merge never changes a surviving
finding's fingerprint, because neither `severity` nor `otherSites` participates in it — so if the two disagree, say so:
either two distinct new findings collided on one fingerprint (the second is being suppressed permanently, which no other
signal reveals) or the round is not returning what it claims. Report the discrepancy and use the set difference, which is
the one derived from the findings themselves.

The corollary is the part that has to be said out loud in every report after the first: **the held findings were not
re-examined this round.** They were not re-read, not re-validated and, under `--fix`, not re-offered — that is precisely
what makes a later round cost about what round 1 cost. So some of them may already be fixed. Say that, and say how many
findings are held versus new, rather than presenting the whole accumulated list as the current state of the code.

Finally, report the held count as a cost signal. Nothing prunes the ledger, so the list handed to the reviewers and to
the cross-unit dedupe pass grows with the review's whole history; past roughly 150 findings that pass starts chunking
(see [Notes](#notes)), which costs `C(m,2)` agent calls rather than `m`. That is measured and reported here, never
enforced: the remedy is the user's, and it is to fix some findings or delete the file.

## Run the workflow

Call the `Workflow` tool with:

- `name` — the string `repo-review`, and nothing else. Reference the workflow by name rather than by path: the harness
  resolves a named workflow out of your Claude config directory itself, honouring `CLAUDE_CONFIG_DIR` and falling back
  to `~/.claude`, so a hardcoded path would be wrong on any machine that does not set that variable the same way. Do
  not substitute `scriptPath` — some sessions restrict this tool to named workflows and refuse a path outright.
- `args` — aim for an **actual JSON object**: `args: { "paths": ["src"] }`, not `args: "{\"paths\": [\"src\"]}"`. In
  practice this call site has been observed to deliver the object JSON-encoded as a string every time, so the script
  parses that form rather than trusting the shape. You therefore do not need to work around it: build the object, pass
  it, and move on. In particular do **not** write a shim workflow to route past it, and do not deliberately send a
  string — one that is not valid JSON cannot be recovered, and the script then reviews nothing and reports a gap. Note
  also that checking you built the right keys is not the same as checking you passed them as an object; only the second
  check was failing.

  Build it from **only the flags the user actually supplied**: add a key for each flag the user gave, and omit the rest.
  The script fills in the documented defaults for anything omitted (whole repository, `--effort high`,
  `--partitions auto`, `--validators 1`, round 1 holding no findings), so do not synthesise default values here, and
  never include `--output` or `--rounds`.

  Two keys do not come from a flag at all. `round` and `knownFindings` come from
  [the ledger](#the-ledger): on a cold start omit both — rather than passing `round: 1` and an empty list, so that the
  common case sends the same `args` it always did — and otherwise pass `round` set to the ledger's `round` plus one and
  `knownFindings` set to its `findings` **verbatim**.

  Worked examples — every one of them a cold start, since the two ledger keys are the same in every row and would tell
  you nothing. Note that every `path` survives every flag combination, that the path-less rows are path-less only because
  the user gave no path, and that the two wrapper-handled flags leave no trace in `args` at all:

  | Invocation                                            | `args`                                                 |
  |-------------------------------------------------------|--------------------------------------------------------|
  | `/repo-review`                                        | `{}`                                                   |
  | `/repo-review src --partitions 6`                     | `{ "paths": ["src"], "partitions": 6 }`                |
  | `/repo-review src lib`                                | `{ "paths": ["src", "lib"] }`                          |
  | `/repo-review --rounds 3`                             | `{}`                                                   |
  | `/repo-review src --rounds 3`                         | `{ "paths": ["src"] }`                                 |
  | `/repo-review 2024 --rounds 3`                        | `{ "paths": ["2024"] }`                                |
  | `/repo-review --fix`                                  | `{ "fix": true }`                                      |
  | `/repo-review --fix --reviewers 2`                    | `{ "fix": true, "reviewers": 2 }`                      |
  | `/repo-review src/a.js --fix`                         | `{ "paths": ["src/a.js"], "fix": true }`               |
  | `/repo-review src --fix lib`                          | `{ "paths": ["src", "lib"], "fix": true }`             |
  | `/repo-review src/a.js src/b.js --fix`                | `{ "paths": ["src/a.js", "src/b.js"], "fix": true }`   |
  | `/repo-review src/a.js --output report.md`            | `{ "paths": ["src/a.js"] }`                            |
  | `/repo-review src/a.js --fix --output report.md`      | `{ "paths": ["src/a.js"], "fix": true }`               |
  | `/repo-review pkg docs --fix --output r.md`           | `{ "paths": ["pkg", "docs"], "fix": true }`            |
  | `/repo-review pkg --effort xhigh --fix --output r.md` | `{ "paths": ["pkg"], "effort": "xhigh", "fix": true }` |

Before you call `Workflow`, state in one line the `args` object you built and the scope it implies — naming every path,
e.g. "Reviewing `src` and `lib` (scoped) with `--fix`." — then check it against `$ARGUMENTS`: every non-flag token must
appear in `paths`, and `paths` must hold exactly as many entries as there were such tokens. If you wrote "whole
repository" when the user gave a path, or named one subtree when they gave two, you have dropped one; fix `args` before
launching. Finalise every argument value *before* you call `Workflow`. Running that workflow *is* the review: it runs
in the background and returns a structured result when it finishes. Do not launch review subagents outside it, do not
re-run it while it is in flight, and — importantly — do not stop and restart it merely to change a default or an
argument you could have set at launch (a run already under way is not wrong just because you could have passed, or
omitted, a value explicitly). The only reason to stop a run is a genuine wedge — most agents done, a few idle for many
minutes — after which you may re-run, watching progress in `/workflows`, optionally at a lower `--effort`.

The result is `{ reviewedCommit, round, findings, newFindings, exclusions, gaps }`:

- `reviewedCommit` — the commit SHA the review was defined against: the `HEAD` the survey read before any agent ran.
  Cite this in permalinks (see the format below) rather than asking git for `HEAD` yourself — a long run can outlive the
  `HEAD` it started on, and links built from a moved `HEAD` point at text no reviewer saw. It is `null` only when the
  survey never reported it, which is the one case where you fall back to `git rev-parse HEAD`.
- `round` — which round this was, echoed back from `args.round`. Read the round number off this rather than off your own
  counter: if the value you passed was unusable the script fell back to 1, and the emphasis its reviewers were actually
  given follows the round it ran, not the one you asked for.
- `findings` — validated issues, and **everything the round was handed as well as what it found**: it is the whole
  accumulated set, already de-duplicated against itself, so it is exactly what the next round's `knownFindings` should
  be — and what [the ledger](#the-ledger) stores. Each has `fingerprint` (see the ledger; the only field to key a finding
  on), `description`, `severity` (`critical`/`high`/`medium`/`low`), `category`, `file`, `lines` (may be empty),
  `otherSites` (other affected `file:line` or modules, may be empty), and `reason`.
- `newFindings` — how many of those this round contributed: found by its own reviewers, kept by dedupe as a defect the
  review did not already hold, and confirmed by its validators. This is the number that decides whether to run another
  round, and it is not `findings.length` minus what you passed in — dedupe can merge two findings from *earlier* rounds,
  which makes the total fall on a round that genuinely found something.
- `exclusions` — `{ path, reason }` entries for everything the partitioner left out (vendored/third-party code,
  generated code, lock files, binaries).
- `gaps` — strings recording every way the run fell short of a complete, clean pass. They come in three kinds, and each
  entry states in prose which it is:

  - **coverage** — a reviewer, lens, or validation that did not complete, or a partition folded down to the unit ceiling.
    Findings may be *missing*.
  - **dedupe** — a dedupe stage that stalled or did not converge. Every finding here *was* reviewed and validated; one
    defect may simply be listed twice.
  - **fix** — present only with `--fix`: a fix that could not be produced, reviewed or verified. This is about fixing
    work, not review coverage.
- `fix` — present **only when `--fix` was requested** and there were findings. It is
  `{ base, sandboxBranches, keepBranches, outcomes }`:
  - `base` — the commit the fix agents were told to branch from: `reviewedCommit` again, under the name teardown checks
    branches against. You verify this rather than assume it (see
    [Report the fix branches](#report-the-fix-branches)).
  - `sandboxBranches` — every branch the run's fix agents reported creating, successful or not, plus the branch each
    agent that never reported back was told to create: one killed mid-run had already cut its branch as its first step,
    and an unrecorded branch is one teardown cannot remove. This is the *candidate* teardown list — everything this run
    is responsible for, and it exists because those branches, not a naming glob, are what that means. A reconstructed
    entry may name a branch that was never actually created (the agent died before creating it), so a "not found" while
    deleting one is expected and not a failure.
  - `keepBranches` — the subset of `sandboxBranches` the script believes carries a commit worth keeping: every
    `applied` fix, and every `review-rejected` one too, because a rejection is an opinion and that branch is the only
    copy of the work it rejected. These must survive teardown. The script has no git access, so this is the agents'
    self-report: treat it as a floor rather than a census, and keep any *other* branch you find sitting ahead of `base`.
  - `outcomes` — one entry per finding:
    `{ fingerprint, description, category, severity, file, lines, status, sha, branch, changedFiles, reason }`. The
    `fingerprint` is the same one on the finding and the same one the fixer was told to write into its commit as a
    `Repo-Review-Finding:` trailer, so it joins a branch to the finding it answers — and it is the only join that
    survives a killed run, since `git log --all --grep 'Repo-Review-Finding: <fp>'` finds the commit with no state file at
    all. `status` is
    `applied` (fixed and committed), `declined` (not a safe, localized fix), `verify-failed` (the fix broke the
    build/tests in its sandbox), or `review-rejected` (reviewers rejected the fix and revisions were exhausted). Only
    `applied` is fixed; every other status is an **unfixed** finding — though a `review-rejected` one still leaves a
    branch behind for you to look at.

## Run the rounds

A round used to be a `for` loop inside the script, and the round loop is yours now. This is not a refactor for tidiness:
Review and Validate are `parallel()` barriers, so a script-internal loop killed in round 3 discarded rounds 1 and 2 with
it. One measured four-round run consumed an entire session limit in 41 minutes and returned **nothing**. A round that
returns is a round that got reported.

A round always runs — the loop below runs at least once, and with `--rounds` omitted it runs exactly once. Only step 3's
cap depends on the flag; everything else, the ledger write included, applies to a single-round invocation too.

1. Call `Workflow` with the `args` you built, ledger keys included.
2. **Report the round before deciding anything, and write the ledger** — the whole
   [Produce the output](#produce-the-output) section, including the branch table when `--fix` was given, including its
   teardown, and including [writing the ledger](#writing-it). Do not accumulate rounds and report once at the end: that
   reintroduces exactly the failure this design removes, since a run interrupted between rounds then has nothing to show
   for the rounds that did finish — and now nothing persisted for the *next invocation* to build on either, which makes
   an interrupted multi-round run cost the same as never having run it. Say which round it was, and how many rounds this
   invocation is running.
3. Stop if any of these holds, and say which one:
   - `newFindings` is `0` — the review has gone dry. This is the ordinary, good ending.
   - This invocation has now run `--rounds` rounds. Count the rounds *you* have run, not the `round` the script echoed:
     that one continues from the ledger, so a fifth-invocation round 9 has run one round, not nine. Report that the cap
     was reached **while the review was still finding things**, so the user knows the review is incomplete and can re-run
     — plainly, re-running is now enough, since the ledger means a fresh invocation resumes rather than starts over.
     Treat it as a coverage gap.
   - A `gaps` entry says the reviewers failed to return. A round nobody reviewed also reports `newFindings: 0`, and that
     is not convergence — report it as a failed round and do not describe the review as dry.
   - The round aborted: a `gaps` entry says the review was aborted, and `newFindings` is `0`. It hands back everything it
     was holding, so the ledger is safe to write and the accumulated review is intact, but nothing was reviewed. Do not
     spend another round on it — the survey or the partition failed, and a retry is the user's call.
4. Otherwise call `Workflow` again with the same `args` plus the two ledger keys updated: `round` set to the previous
   `round` **plus one**, and `knownFindings` set to the previous round's `findings` **verbatim**. Pass that array through
   untouched — do not re-sort it, prune it, re-word a description, or drop the ones you judged low value. The script
   merges this round's raw findings against it, which is what turns a re-report into an absorbed duplicate rather than a
   second entry, and a finding you edited is one it can no longer recognise as the same finding. It also skips
   re-validating and re-fixing everything on that list, so a finding you drop from it comes back as new and is paid for
   twice.

Each round is a separate `Workflow` call and so a separate `/workflows` tree; the survey and partition run again in each
one, which is the price of a round being self-contained. Later rounds are handed what is already held and are pushed to
look elsewhere, so they cost about the same as round 1 and find less — that is the point at which to stop, not a reason
to raise the cap.

The `--rounds` loop and the ledger are two mechanisms for one thing, and the ledger is the stronger of the two: it makes
a round durable across invocations, where the loop only makes it durable within one. So `--rounds 4` and running
`/repo-review` four times reach the same place, and the second is strictly safer — each invocation is reported and
persisted before the next begins, and nothing is lost if the session ends between them. Prefer suggesting a re-run over
suggesting a higher `--rounds`.

## Produce the output

From the returned result, produce a summary to the terminal, ordered by severity, most severe first (break ties by
putting security and correctness findings ahead of consistency, architecture, code-quality, test, and `CLAUDE.md`
findings):

- Open with the round's contribution, in one line: how many findings are **new this round** (the set difference described
  under [What this round actually contributed](#what-this-round-actually-contributed)) and how many were already held.
  Lead with the new ones in the list below, since they are the only part of it this round looked at.
- If findings were returned, list each with its severity, a brief description, the file and line (or the set of files
  and modules involved, for repository-wide findings), and why it was flagged. Link each to its source with the
  permalink format below, and note any `otherSites`. Mark each as new this round or held, and for a held one give the
  round it was first seen in — a finding outstanding since round 1 of four reads very differently from one found minutes
  ago. Then say once, plainly, that the held findings were **not re-examined this round** and some may already be fixed.
- If none were returned, state: "No issues found. Checked for bugs, security, consistency, code quality, architecture,
  test coverage and quality, and `CLAUDE.md` compliance." Only say that when the *accumulated* set is empty. A later
  round returning nothing at all means dedupe merged away or validation rejected everything the review held, which is a
  surprising result worth naming as such rather than reporting as a clean repository.
- In both cases, state which parts of the repository were excluded (`exclusions`), and report every entry in `gaps` —
  no gap may read as "clean". Label each one by its kind (above), which the entry's own wording tells you: a **coverage**
  gap is **not reviewed / not validated**; a **dedupe** gap was reviewed and validated but may be **reported twice**; a
  **fix** gap is a finding **not fixed** and not verified as unfixable. Do not report a dedupe or fix gap as missing
  review coverage — mislabelling one hides a real gap behind a false alarm.
- When a `fix` object is present, annotate each finding with its outcome from `fix.outcomes` (fixed, or the reason it
  was not), and report the branch table (below) plus a tally: how many findings were fixed (`applied`) versus left
  unfixed (`declined` / `verify-failed` / `review-rejected`). An unfixed finding must never read as fixed.

### Run summary

End the report with a **Run summary** stating what the run consumed. Everything it needs is on the `Workflow` result
itself rather than inside `result`: `agentCount`, `totalToolCalls`, `totalTokens`, and the `workflowProgress` array.
That array interleaves two kinds of entry — agents, which carry `model`, `tokens`, `toolCalls` and `durationMs`, and
bare `type: "workflow_phase"` markers, which carry none of them — so filter to the entries that have a `model` before
you tally anything. The agent `tokens` sum to exactly `totalTokens`; if yours don't, you have counted the phase markers.

Report, in a few lines:

- **Scale** — `agentCount` agents, `totalToolCalls` tool calls, and the wall-clock duration.
- **Total tokens** — `totalTokens`, broken down per model tier. Bucket each agent by the tier named in its `model`
  string (they arrive as fully-qualified IDs such as `au.anthropic.claude-opus-5` or
  `au.anthropic.claude-sonnet-4-5-20250929-v1:0`, so match on the `opus`/`sonnet`/`haiku` substring, not on equality).
- **Approximate cost** — the per-tier token counts priced at the tier's **output** rate and summed.

`tokens` counts **output** tokens only; no field in the result reports input or cache-read tokens. That is the same
accounting the `Workflow` tool's own `budget.spent()` documents, and the magnitudes confirm it — a run averaging ~32k
tokens per agent cannot be counting input, since a single reviewer re-sends its whole context on every one of its dozen
or so tool-call turns.

Price it at Anthropic's list rates, per million tokens (verified 2026-08-27 against
https://platform.claude.com/docs/en/about-claude/pricing.md  — that `.md` suffix serves clean markdown, so it is worth
re-fetching rather than trusting this copy).

**Every rate below is USD and deliberately written without a dollar sign — do not add one.** Argument substitution
rewrites a dollar sign followed by a single digit anywhere in this file *before* you ever read it, so a currency figure
written that way arrives as an **argument value** with the remaining digits stuck to it: a rate of five dollars becomes
the sixth argument followed by `.00`, and a fifty-cent rate becomes the whole argument list followed by `.50`. The table
on disk was correct for months while every invocation silently received a corrupted one — the rates being read were
whatever paths the user happened to pass. No escaping helps, because the rewrite is textual and happens first; so the
sign is simply absent from the data and the unit lives in the column header instead. Note that this paragraph must obey
its own rule, which is why it spells the amounts out in words. Apply it to any currency figure added later.

| Model                            | Output (USD/1M) | Input (USD/1M) | Cache read (USD/1M) |
|----------------------------------|-----------------|----------------|---------------------|
| Fable 5                          | 50.00           | 10.00          | 1.00                |
| Opus 5 / 4.8 / 4.7 / 4.6 / 4.5   | 25.00           | 5.00           | 0.50                |
| Sonnet 4.6 / 4.5                 | 15.00           | 3.00           | 0.30                |
| Sonnet 5 (from 2026-09-01)       | 15.00           | 3.00           | 0.30                |
| Sonnet 5 (intro, to 2026-08-31)  | 10.00           | 2.00           | 0.20                |
| Haiku 4.5                        | 5.00            | 1.00           | 0.10                |

Match the **version** and the run's date, not just the tier: through 2026-08-31 Sonnet 5 is 33% cheaper on output than
Sonnet 4.5/4.6, so collapsing them into one "Sonnet" rate misprices the run — once that introductory rate lapses the two
bill alike. If an agent's `model` names a version that is not in this table, say so and leave it out of the total rather
than guessing a rate.

State the figure as approximate and say why, in one line — do not present it as a bill. Because input and cache-read
tokens are unreported, the computed number is a **floor**. Input tokens are far more numerous than output tokens on a
review run (every reviewer reads files) but are priced at a fifth of the output rate — and a *cached* read at a fiftieth
of it — so the all-in figure has tended to land within roughly a factor of two of the floor. Offer that as an
order-of-magnitude expectation, not a second number to add — it is a rule of thumb, not measured.

A worked example, from a 32-agent single-file `--fix` run — note that Opus is 79% of the tokens and 88% of the cost, so
the per-tier split is the useful part of this summary, and the reviewer count (`--partitions` × 6, see
[Notes](#notes)) is where it is actually spent:

| Tier          | Agents | Tokens        | Output rate (USD/1M) | Cost (USD) |
|---------------|--------|---------------|----------------------|------------|
| Opus 5        | 25     | 806,803       | 25.00                | 20.17      |
| Sonnet 4.5    | 5      | 168,826       | 15.00                | 2.53       |
| Haiku 4.5     | 2      | 39,896        | 5.00                 | 0.20       |
| **Total**     | **32** | **1,015,525** |                      | **22.90**  |

If `workflowProgress` is missing or carries no per-agent `model`, still report `totalTokens` and the scale line, and say
the per-tier cost breakdown was unavailable — an unpriceable run is not a free one.

If `--output <file>` was provided, write the same report to that file.

## Report the fix branches

Only when a `fix` object was returned. Each fix already exists as a commit on a branch of its own, made by an agent in
an isolated worktree. **You do not land it.** You do not cherry-pick, merge, rebase, switch, edit a file, resolve a
conflict, or amend a commit: you verify what exists, report it, and delete only the sandboxes that hold nothing.

That is the opposite of what this command used to do, and the reversal was deliberate. Landing meant cherry-picking
every fix onto one branch, which is sound only if the fixes are pairwise-disjoint in their files — an invariant the
script can never actually verify (it has no git access, so "disjoint" is only ever what the fix agents *said*), and one
that real runs broke twice over: four fixes each rebuilt `dist/server.cjs`, and a shared allowlist that two separate
fixes both had to touch produced a "disjoint" pair that passed apart and failed together. Enforcing disjointness meant
*discarding real fixes* to protect a merge nobody had asked for. So fixes are now additive and independent — one branch
each, freely overlapping — and whoever wants two of them together does that deliberately, with the conflict in front of
them.

1. **Note where the repository is.** Run `git rev-parse HEAD` and compare it with `fix.base`. If they differ the
   checkout has moved since the review; say so, and say how far, but do not treat it as a failure — nothing is being
   applied, so a moved `HEAD` costs the user a rebase rather than costing correctness. You do **not** need a clean
   working tree for any of this, and must not stash, commit, or check anything out to get one.
2. **Verify every branch against git before you name it.** For each entry in `fix.keepBranches`, and each distinct
   `outcome.branch` that came back with a `sha`, run `git rev-parse <branch>` and `git rev-parse <branch>^`. The branch
   must resolve, and its first parent must be `fix.base`. A branch that does not resolve, or that resolves *to*
   `fix.base`, carries no commit at all: the agent reported a fix it never made. That is a **defect in the run**, not an
   unfixable finding — say so plainly, and count the finding as not fixed. A branch whose parent is some other commit
   still holds work; keep it, but say the base is not the one the run claimed.
3. **Report a table**, one row per branch that verified, most severe first:

   | branch | commit | severity | category | file | fix status |
   |---|---|---|---|---|---|

   Abbreviate the `sha` from the outcome, and give the finding's description in the row or immediately beneath it. Then
   say once, plainly, that these branches are **unmerged**: nothing has been applied to the working checkout, they are
   all cut from `fix.base`, and two of them may well touch the same file, so taking more than one is a deliberate act
   that may need a conflict resolved. Point the user at `git diff <base-sha>..<branch>` to read one and
   `git cherry-pick <sha>` to take one, spelling out the real SHAs. Those are suggestions *for the user to run* — they
   are not in your `allowed-tools`, and you do not run them.
4. **Tear down only the empty sandboxes.** Every worktree goes; a branch goes only if it holds nothing. This inversion
   is the whole point of the phase: a branch *is* the product of `--fix`, so the failure to avoid is deleting one that
   holds work, not leaving an empty one behind. When in doubt, keep it and say you did — a stray `rrfix/*` ref costs
   nothing, and per-run branch names mean a leftover cannot break the next run. (They are per-run for exactly that
   reason: the fixers used to restart at `rrfix/0` every time, and one run ending without teardown made the next run's
   `git switch --create rrfix/0` fail outright.)
   - **Worktrees first, all of them.** A branch checked out somewhere cannot be deleted, and a branch you are keeping
     does not need its worktree — the commit lives in the repository, not in the checkout. For each entry in
     `git worktree list --porcelain` whose `branch` is one of `fix.sandboxBranches` *or* is a `worktree-<run-id>-<n>`
     branch for this run's `<run-id>`, run `git worktree remove <path>`, adding `--force` if it refuses: the commit is
     what you reported, and anything else left in the sandbox is scratch. Match both forms, because a fixer only moves
     onto its `rrfix/*` ref once it has run its own `git switch --create`: one that died before that leaves a sandbox
     still checked out on the `worktree-<run-id>-<n>` ref the harness made it on, which the `rrfix/*` refs alone never
     match. Miss it and both the worktree and that branch leak — the branch delete below cannot touch a ref that is
     checked out, and `git worktree prune` only drops administrative files for worktrees whose directory is already
     gone.
   - **Then delete `fix.sandboxBranches` minus everything step 2 found carrying a commit.** That is `keepBranches` plus
     any branch you found ahead of `fix.base` that was not on it — the script reports from the agents' self-report, so
     git is the authority here and it overrules the list in the keep direction only. Never in the delete direction: a
     branch missing from `keepBranches` that turns out to hold a commit is exactly the agent that committed and then
     died before reporting back, and its branch is the only copy of that work.
   - **Delete refs by exact name, not by prefix.** The list itself is the authority for *scope*: the script has already
     screened every entry into the `rrfix/<run-id>/<n>` namespace, so exact-name deletion is inherently confined to this
     run and cannot reach `master` or a concurrent run's branches. Do not filter the list down to one `<run-id>` before
     deleting — the run id is derived *by each agent* from its own worktree branch, and that derivation has failed in a
     real run: 49 of 116 names came back as `rrfix/undefined/<n>` and one had mis-split the id into
     `wf_6c337c34-fb5-400`. Those branches exist. Prefix-filtering them out of the delete list leaves them behind, which
     is precisely the leak the list is meant to prevent.
   - Use `git branch --delete --force`, and spell both flags out long-form: the `allowed-tools` rule is a literal prefix
     match on `git branch --delete --force`, with no flag aliasing, so the `-D` shorthand misses it and costs you a
     confirmation prompt mid-teardown. `--force` rather than a safe delete because these branches were never merged
     anywhere, so `--delete` alone would refuse every one of them. A ref git reports as not found is not an error: the
     list includes the branch an agent that never reported back was told to create, and it may have died before creating
     it. Skip that one and keep going through the rest.
   - You still need a single `<run-id>` for the `worktree-<run-id>-<n>` refs, because those are *not* on the list and
     can only be matched by pattern. Take the one appearing in the **most** `fix.sandboxBranches` entries rather than
     the one in the first entry, and ignore `undefined` / `null` outright. When the names disagree the script says so in
     `gaps`; expect `worktree-*` refs under the minority ids to survive teardown, and report them as leftovers rather
     than widening the pattern to catch them. The harness does not reap those refs itself — they are what the fix
     branches were cut from — so delete the ones for this `<run-id>` (the worktree step above has already released any
     sandbox still checked out on one), then finish with `git worktree prune` to drop the stale administrative files.
     **Never glob `worktree-*`.** That namespace belongs to every worktree-isolated agent in the session, not just this
     run, so an unscoped delete destroys unrelated work; match on this run's `<run-id>` and nothing else.

   Touch nothing this run did not create, and never reconstruct either set from a guess: for the `rrfix/*` refs that
   means deleting only names that appear in `fix.sandboxBranches`; for the `worktree-*` refs, which are not listed, only
   the majority `<run-id>` read out of those names.

Do not push, and do not open a pull request. Do not merge the branches anywhere, including into each other.

Without `--fix`, this command only reports: do not create GitHub issues, do not post comments, do not edit files, and
do not commit anything. With `--fix`, the *only* actions it takes are the read-only verification above and the teardown
of the empty `rrfix/*` sandboxes it created — it still does not edit, commit, merge, push, comment, or open PRs.

The two files this command writes are not exceptions to that. `--output` writes where the user pointed it, and
[the ledger](#the-ledger) is this command's own state, at a fixed path, holding only what it just reported. Neither is a
source file and neither is committed — if the user does not want the ledger tracked, `.claude/` belongs in their
`.gitignore`, which is their decision and not one to make for them.

## Notes

- The script enforces what this command depends on, so you do not manage it here: it sets each agent's `model` tier
  (`haiku`/`sonnet`/`opus`) and its `effort`, and it caps the high-fan-out reviewers and validators at `xhigh`, clamping
  `max` down. That cap is a deliberate reliability tradeoff — those agents run at high multiplicity (roughly
  `--partitions` × 6 reviewers, plus validators per issue), and launching that many concurrent `max` Opus inferences has
  been observed to intermittently stall (an agent gets its tool result and its next turn never arrives). Because the
  review phase is a `parallel()` barrier, one hung agent can wedge the run; the cap keeps the many leaf agents off
  `max`, the only level observed to stall. A *silent* hang has no timeout to recover from — hence watching `/workflows`
  above.
- The dedupe agents are capped harder still, and never run at `max`, for a related but distinct reason. The harness
  kills an agent that reports no progress for 180s, and dedupe calls no tools, so it reports nothing while it thinks. At
  `max` that killed all six attempts of a 155-finding round — and a stalled agent *throws*, so it failed a run that was
  42 of 43 agents done. The script now starts dedupe at `high` (107s to first token on that same round), steps down to
  `medium` on a stall, and catches the throw. Deciding *which* findings collide is shallow work — it returns indices and
  the script does the merging — so the lower rung costs little.
- **A `dedupe:…:high … (retry 5) FAILED` row is normal and is not a failed review.** Every rung names its effort, so a
  step-down appears as two rows: the exhausted `dedupe:cross:high` stays on screen permanently, marked FAILED, and
  `dedupe:cross:medium` beneath it is the one that answered. `/workflows` draws nothing connecting them. Before calling
  a run lost, check for a lower rung and check `gaps` — the script only gives up on a merge after every rung fails, and
  it says so there. Losing a rung costs deduplication, never findings.
- Rungs a digest is known to overwhelm are skipped rather than attempted, because exhausting one costs six attempts at
  180s — 18 minutes in which the run emits nothing and looks hung. `high` was measured answering 116 findings in 96s
  and 163 in ~2 minutes, then killed on all six attempts at 209 and at 253; `medium` answered both, in ~140s. So a
  digest above 180 findings starts at `medium`, and the script logs that it did — a guard the 150-finding chunk cap
  below now keeps out of reach, since `chunkScopes` applies that cap to stage one's scopes as well and no agent is
  handed more than one chunk. So do not go looking for that skip log to explain a wedged run: a step-down at any label,
  `dedupe:<unit>` or a chunked `dedupe:cross:1+2` alike, is an agent that stalled *under* its rung's own ceiling rather
  than one skipped over it. A skip log at all would mean a scope escaped chunking.
- Dedupe runs in two stages, because think time tracks how many findings one agent was handed. Stage one runs an agent
  per unit in parallel (`dedupe:<unit>`, plus `dedupe:cross-cutting` for the repo-wide findings no unit claims), which
  catches the common case: six reviewers reading one unit from different angles report the same defect six times. Stage
  two then compares what survived, to catch a defect reported under two different units. Both are `parallel()` fan-outs,
  so a stalled agent costs only its own merges, and each partial failure is its own `gaps` entry — a lost unit repeats a
  defect *within* one unit, a lost cross chunk repeats one *across* two. Stage two is skipped entirely when a single
  scope held everything *and* fitted in one chunk, since then one agent already compared every pair; a unit too big for
  one chunk always reaches stage two instead, whose passes close the chains splitting a scope costs stage one.
- **Chunking is what actually bounds this phase, and it bounds both stages.** Splitting the union by unit is a partition,
  not a bound: unit sizes are the partitioner's choice, so a repository whose code sits mostly in one unit would hand
  that whole scope to one agent. Stage two has no partition at all and sees every survivor accumulated so far — on one
  measured four-round run the cross pass was handed 116 findings in round 1, 209 in round 2 and 262 in round 3, while
  the largest single unit scope in that entire run was 68, so the fan-in grows with what a round is handed however well
  the units are split. So any scope over 150 findings — under the 163 the top rung was measured answering — is chunked, at either
  stage. Because a contiguous slice of the union is mostly one unit's findings (the ones stage one already merged) while
  cross-unit pairs sit far apart in that order, the chunks are built as every unordered *pair* of half-chunk blocks. That
  way any two findings share at least one chunk, so a chunked stage sees every pair a single agent would have, at
  `C(m,2)` calls instead of `m`. Chunks appear as `dedupe:cross:1+2`, and a split unit as `dedupe:<unit>:1+2`.
- The chunked pass repeats until it converges, because merging is first-claim-wins rather than transitive: chunks
  reporting `{A,B}` and `{B,C}` leave C unmerged, since B is already claimed by the time the second group is read. Each
  pass closes one link of such a chain, so later passes are marked `dedupe:cross:p2:1+2`, and the loop stops as soon as
  a pass merges nothing — or when one chunk held everything, since then a single agent already saw every chain. Three
  passes is the budget; still merging after that records a `gaps` entry, which means a defect reported under three or
  more units may appear twice. That is the only remaining degradation, and it is bounded and reported.
- Both phases label a unit by a short slug rather than the prose name the partition agent chose, so a unit named "Wire
  Protocol Layer" appears as `review:wire-protocol:bug` and `dedupe:wire-protocol`. `/workflows` clips a label at around
  40 columns from the right, and with a title-cased name it was clipping the *category* — the one segment saying which
  of six reviewers a row is. The script caps the slug at 16 characters so `review:` plus the slug plus the longest
  category still fits, and it numbers slugs that collide
  (`wire-protocol-2`) so two units are never one indistinguishable row. Reviewers are still told the prose name, so use
  that when you describe a unit in the output — the slug is for reading the progress tree, not for the report.
- The Review phase costs roughly `units × 6 reviewers`, plus 3 architecture lenses, per round — so the unit count is
  the dominant cost lever. The script sizes it from the survey's file counts (see `--partitions`) and, on a scope of two
  files or fewer, skips the three whole-repo architecture lenses entirely, recording that skip in `gaps`. Report it like
  any other coverage gap: architecture was **not reviewed**, not "clean".
- The script resolves failures it can see: each fan-out runs under `parallel()`, which resolves a failed agent to
  `null` rather than rejecting the batch, and every dropped reviewer, lens, validation, dedupe stage or fix pipeline is
  recorded in `gaps`. Surface those gaps in the output, each under its own kind — only the dropped reviewers, lenses and
  validations are lost *review coverage*.
- A round is a whole invocation of the script, survey and partition included, and validation and `--fix` run inside it
  over **only what that round contributed** — not over the accumulated set. That is what makes a round cost about the
  same as round 1 instead of as much as every round before it put together: the old in-script loop re-validated and
  re-fixed everything held, so round 4 paid for rounds 1 through 3 again. The price of the new shape is re-surveying and
  re-partitioning each round, which is two agents against a fan-out of dozens. Re-partitioning does move unit
  boundaries between rounds, which no longer defeats cross-round dedupe: the round is handed the findings already held
  and merges its own against them whatever units it drew this time. Because each round multiplies the high-fan-out
  review phase, watch `/workflows` as with any long run.
- That "already known" list is scoped by **unit, not by category**, and this matters more than it sounds. When it was
  category-scoped, the Bug reviewer could not see that Security had already reported the same defect on the same lines,
  so it reported it again and dedupe paid for the duplicate afterwards at full review cost. Across one measured
  four-round run, 68% of the duplicates dedupe merged sat in groups spanning more than one category — 40% of everything
  the reviewers produced — and four separate findings for a single missing length check survived even that, because the
  dedupe prompt is deliberately reluctant to merge across categories and cannot be made eager without hiding real
  defects behind unrelated ones. So a reviewer now sees every finding held for its unit, in two lists: its own
  category's, to look past, and the other reviewers', to recognise and not restate. The architecture lenses read the
  whole repository and so have no unit to scope by; they see everything, which is the largest such list a run builds.
- With `--fix`, the Fix phase adds one worktree-isolated agent **per validated finding**, each of which edits and then
  runs the repository's typecheck/tests in its sandbox before committing — the expensive-and-slow part. A fixer commits
  only a clear, safe, localized change that still passes; otherwise it declines or reports a verify failure, and that
  finding is reported unfixed. In-sandbox verification silently degrades to "commit the edit" when the repository has
  no runnable test suite, so the branch-per-fix plus your own reading of the diff is the real safety net. Nothing is
  merged and nothing is pushed, and the working checkout is left untouched by construction rather than by promise: this
  command no longer has a `git switch`, `git cherry-pick` or `git checkout` in its `allowed-tools` at all. The previous
  design *did* promise that and broke it — a cherry-picked `100755 → 100644` mode change survived the switch back and
  dirtied the user's tree.
- **A fix sandbox is not checked out at your `HEAD`.** `isolation: 'worktree'` creates the worktree on a branch
  `worktree-<run-id>-<n>` pointing at the **remote default branch** — `refs/remotes/origin/master` — not at local
  `HEAD`. In one observed run every one of 81 sandboxes was based 126 commits behind the `HEAD` the reviewers had read.
  Two things followed, and dropping the landing sequence only cures the second:

  - The fixers read and edited 126-commit-stale source while the findings described current source. No downstream step
    can repair that: a change reasoned about against text that no longer exists is not rebaseable, only discardable.
    **This is still fatal.** A branch is only worth reporting if its diff was authored against code the user recognises.
  - The bases diverged *unpredictably*. Pinning was left to agent initiative, so some fixers noticed the mismatch and
    re-based onto local `master` themselves while most committed straight onto the stale base — four distinct bases
    across one run. That used to void the cherry-pick guarantee; now it costs only a confusing report, which is why
    step 2 of [Report the fix branches](#report-the-fix-branches) reports an unexpected parent rather than rejecting the
    branch over it.

  The script pins every sandbox explicitly: the survey captures `git rev-parse HEAD` as `headSha` before any worktree
  exists, and each fix agent's first instruction is to `git switch -c <branch> <headSha>` and verify the pin took before
  reading a file. It refuses to run the Fix phase at all if that SHA is unavailable — an unpinned fix phase produces
  confident-looking commits built on the wrong code. Do not weaken that: the failure is silent, and it reads as success.
- **Fixes must not commit regenerated build output.** A fix whose verification step rebuilds a tracked artifact and
  stages it drowns its own change: `dist/server.cjs` is tens of thousands of lines, and a branch whose diff is one
  useful hunk buried in a regenerated bundle cannot be reviewed, which for a report-only phase means it cannot be used
  at all. In one measured run four fixes each rebuilt that file. The script names the partitioner's generated/excluded
  paths to the fixers as unstageable, and that is prose to the fixer rather than a gate on the result: refusing a commit
  outright over a cosmetic defect in its diff would throw away a real fix, which is the mistake the whole
  landing-sequence removal exists to stop repeating.
- The Review Fix phase (unless `--reviewers 0`) adds, per applied fix, `--reviewers` read-only reviewers that judge the
  diff for correctness and quality — the thing the in-sandbox tests can't. A fix rejected by a majority is handed back
  to a fresh fixer with the objection and re-reviewed, up to an internal cap of two revisions, then reported
  `review-rejected` if it still fails. A `review-rejected` branch is still reported and still kept: with nothing being
  landed, a rejection is an opinion about a commit rather than a reason to destroy the only copy of it. Cost is roughly
  `findings × up-to-3 fix attempts` (the expensive worktree + test runs) plus
  `findings × up-to-3 review rounds × --reviewers` (cheaper read-only reviewers); `--reviewers 0` skips the review cost
  entirely and reports every fix that passed its own sandbox verification as applied.
- `allowed-tools` governs only this wrapper — running the workflow, verifying and reporting the fix branches, and
  formatting the result — not the subagents the workflow launches. Those carry their own default tool pool, so reviewers
  and validators can `Read`, `Grep`, `Glob`, and `git ls-files`, and the `--fix` agents can `Edit` and commit in their
  own worktrees, regardless of this list; you neither need to nor can provision their tools from here. This list is
  therefore minimal, and every entry in it is read-only *or* deletes something this run created: `Workflow` to run the
  review, `Read` for [the ledger](#the-ledger), `Write` for the ledger and for `--output`, `git remote get-url` and
  `git rev-parse` to build permalinks and to check the fix
  branches against git, and `git worktree list`/`remove`/`prune` plus `git branch --delete --force` to tear down the
  sandboxes. There is deliberately **no** way to change the code under review or the repository's git state from here —
  no `git switch`, no `git checkout`, no `git cherry-pick`, no `git commit`. `Write` is the one entry that puts bytes on
  disk, and its two uses are named above: a report the user asked for by name, and this command's own state file.
  Neither touches a source file, and neither is committed. The report-only design is enforced by the absence of those
  entries, not by the
  prose asking for it, because prose and a permission pattern are two enforcement layers and the pattern wins silently
  when they disagree.
- Seven entries were removed when landing was removed (`git cherry-pick:*`, `git checkout --:*`, `git status:*`,
  `git show:*`, `git switch -`, `git switch --create repo-review-fixes`, `git branch --show-current`), and that removal
  is the load-bearing part of the change rather than tidying after it. Each of those existed for one step of the landing
  sequence, and each had already been narrowed once after the broad form turned out to pre-approve something the prose
  forbade: `Bash(git checkout:*)` pre-approved `--ours`/`--theirs`, which is resolving a conflict by hand;
  `Bash(git switch --create:*)` pre-approved a start-point plus `--force` — upstream an alias for `--discard-changes` —
  so `git switch --create repo-review-fixes HEAD~1 --force` exits 0 on a dirty tree and throws the uncommitted work
  away. That history is the reason not to leave them behind "in case": a pre-approved write is a write the next model to
  read this file can make without a prompt.
- The same narrowing still applies to what remains. `Bash(git remote:*)` would pre-approve `set-url`, and
  `Bash(git branch:*)` would pre-approve `--force` (which silently moves a branch and can orphan commits) and `-m`,
  hence `git remote get-url:*` and `git branch --delete --force:*` rather than the subcommand wildcards, and one entry
  each for `git worktree list`/`remove`/`prune`. Only the *refs* teardown deletes are computed at run time, so pinning
  the subcommand flag costs nothing; `rev-parse` is the one whose arguments are all computed and cannot be usefully
  narrowed. A prefix rule matches only the exact string or that string followed by a space — which is why
  `git branch --delete --force` must be spelled long-form for the rule to match at all — and it is hygiene rather than a
  safety boundary: `allowed-tools` is allow-only, so a pattern that stops matching restores a confirmation prompt and
  never removes a capability.
- Cite each finding with a file path and line range, and link it if the repository has a GitHub remote. Follow this
  format precisely, otherwise the Markdown preview won't render correctly:
  https://github.com/anthropics/claude-code/blob/c21d3c10bc8e898b7ac1a2d745bdc9bc4e423afe/package.json#L10-L15

  - Requires the full commit SHA of the reviewed tree: use `reviewedCommit` from the result, which is the `HEAD` the
    review was actually read at. Ask git for it (`git rev-parse HEAD`) only if `reviewedCommit` is `null`, and say in
    the report that the links are anchored to current `HEAD` rather than to the reviewed commit.
  - Repo name must match the repo you're reviewing. Get the remote with `git remote get-url origin`; it may be in SSH
    form (`git@github.com:owner/repo.git`), which you must convert to `https://github.com/owner/repo`.
  - `#` sign after the file name.
  - Line range format is `L[start]-L[end]`. Single line format is `L[number]`.
- If the repository has no GitHub remote, cite findings as `path/to/file.ext:12-18` instead.
