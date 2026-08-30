---
name: Repo Review Fix
description: Fix findings from a previous repository review
argument-hint: >-
  [--effort <low|medium|high|xhigh|max>]
  [--max-fixes <n>]
  [--output <file>]
  [--reviewers <n>]
  [--severity <low|medium|high|critical>]
allowed-tools:
  - Bash(git branch --delete --force:*)
  - Bash(git rev-parse:*)
  - Bash(git worktree list:*)
  - Bash(git worktree prune:*)
  - Bash(git worktree remove:*)
  - Read
  - Workflow
  - Write
---

Fix findings that `/repo-review` has already found and validated.

This is the **write** half of the review. `/repo-review` finds defects and writes them to a ledger; this command reads
that ledger, fixes what it can, and hands you a branch per fix. The two are separate commands because they are separate
authorizations: the review only reads, this one commits. They were one command with a `--fix` flag, and the coupling cost
both halves — every fix run paid for a full re-review to reach the fixers, so fixing the findings you already had meant
re-deriving them first, and the fix phase could only ever see the findings *that round* confirmed.

The work runs as a committed **workflow** — `repo-review-fix`, referenced by name — which surveys the tree, then fans out
one isolated agent per finding to attempt a fix and one or more to review it. This command is a thin wrapper: read the
ledger, parse the arguments below, run that workflow, verify what it claims against git, report the branches, tear down
the empty sandboxes, and update the ledger. The algorithm — the pinning, the model tiers, the caps, the revision loop —
lives in the script; do not re-implement it here, and do not launch fix agents any other way.

**This command lands nothing.** Every fix is a commit on a branch of its own and stays there. See
[Report the branches](#report-the-branches) for what that rules out.

## Parse arguments

The arguments to this command are: `$ARGUMENTS`. Parse them as follows.

There are **no path arguments**. Unlike `/repo-review`, nothing here is scoped by path: the findings come from the
ledger, each one already naming its own file. So every token is either a `--flag` or the value of the flag before it, and
a bare token is an error — say so and stop, rather than guessing that it was meant as a path or as a value.

- `--severity <low|medium|high|critical>` sets the lowest severity worth fixing. Those are the four the review's
  findings carry; reject anything else and stop with an error rather than guessing. If omitted, the script defaults to
  `low`, i.e. every finding is eligible. It is a floor, not a filter: `--severity high` means high **and** critical. Pass
  it through as `severity` when given; omit it otherwise.

  A finding whose `severity` the script does not recognise — only reachable in a hand-edited ledger — ranks as `low`, so
  it sorts last and any floor above `low` excludes it. That is not silent: it lands in the count the shortfall gap
  reports.
- `--max-fixes <n>` caps how many findings this invocation attempts. Must be a non-negative integer; reject any other
  value and stop with an error rather than guessing. If omitted, the script defaults it to `5`. The script selects
  worst-first, so the cap always spends itself on the most severe findings available, and it reports what it left behind
  as a gap. `--max-fixes 0` is legal and useful: it selects nothing, spawns no agent at all, and reports how many
  findings were eligible — which is how you ask what a run *would* attempt without paying for it. Pass it through as
  `maxFixes` when given; omit it otherwise.

  This is the flag that decides what the run costs. One finding costs a fixer plus its reviewers, on Opus for the
  high-risk categories, plus up to two revisions if the reviewers reject the fix — so the ceiling is real work and the
  default is deliberately low. Raising it is how the user spends more; nothing else here multiplies.

- `--reviewers <n>` sets how many independent reviewers judge each fix. Must be a non-negative integer; reject any other
  value and stop with an error rather than guessing. If omitted, the script defaults it to `1`. A fix is kept only on a
  **strict majority** of its reviewers; a rejected fix is sent back to a fresh fixer with the objection and re-reviewed,
  up to an internal revision cap, before being reported unfixed. **`--reviewers 0` disables fix review entirely** —
  every fix that verified in its own sandbox is then reported without a second opinion on it. Pass it through as
  `reviewers` when given; omit it otherwise.
- `--effort <low|medium|high|xhigh|max>` sets the requested reasoning effort for the workflow's subagents. If omitted,
  the script uses `high`. Reject any other value and stop with an error rather than guessing. When given, pass it through
  unchanged — the script caps its high-fan-out agents at `xhigh` itself (see [Notes](#notes)); you do not clamp it here.
- `--output <file>` writes the report to that file in addition to the terminal. This command handles it; do **not** pass
  it to the script. Its filename is the value of the flag before it, so it is never mistaken for anything else.

Worked examples. Every row is a run against a ledger that already exists — see [The ledger](#the-ledger) for where
`findings`, `exclusions` and `reviewedCommit` come from, which is the same in every row and so is elided here:

| Invocation                                        | `args` beyond the ledger keys            |
|---------------------------------------------------|------------------------------------------|
| `/repo-review-fix`                                | `{}`                                     |
| `/repo-review-fix --max-fixes 12`                 | `{ "maxFixes": 12 }`                     |
| `/repo-review-fix --severity high`                | `{ "severity": "high" }`                 |
| `/repo-review-fix --severity high --max-fixes 20` | `{ "severity": "high", "maxFixes": 20 }` |
| `/repo-review-fix --reviewers 3`                  | `{ "reviewers": 3 }`                     |
| `/repo-review-fix --reviewers 0 --max-fixes 1`    | `{ "reviewers": 0, "maxFixes": 1 }`      |
| `/repo-review-fix --max-fixes 0`                  | `{ "maxFixes": 0 }`                      |
| `/repo-review-fix --effort xhigh`                 | `{ "effort": "xhigh" }`                  |
| `/repo-review-fix --output fixes.md`              | `{}`                                     |

## The ledger

**`.claude/repo-review.json`, at the root of the repository being fixed** (not in your config directory). It is written
by `/repo-review` and its format is documented there. This command reads it, and updates two things in it afterwards.

It is not optional. There is no way to fix a finding this command has not been told about, and no way for it to find one
itself — finding defects is the other command's job, and doing it here would be the coupling the split removed.

### Reading it

1. `Read` the file. **If it does not exist, stop.** Say that there is no review to fix, name the file, and tell the user
   to run `/repo-review` first. This is not a cold start to recover from: unlike the review, which can begin from
   nothing, this command has nothing to do without it.
2. If it exists but cannot be parsed as JSON, or `findings` is not an array, stop and say so plainly, naming the file. Do
   not overwrite it — you would be destroying a review you could not read, and the user may be able to repair it by hand.
3. If `version` is a number **greater than 1**, stop. A newer version of these commands wrote it and its findings are not
   yours to reinterpret. Say which version you found.
4. If `findings` is an empty array, stop and say so: the review found nothing, or everything it found has been fixed. Do
   not run the workflow — it would refuse anyway, and the refusal costs a launch.

Then take three things from it, and pass them through **verbatim**:

- `findings` — every entry, unfiltered. Do **not** apply `--severity` or `--max-fixes` yourself, and do not pre-select
  what looks worth fixing. The script does the selecting, and it is the script's job precisely because a cap the caller
  applies is a cap the caller can forget: the whole reason this command exists is that the previous design let the work
  scale without a ceiling. Pass the list; let the script cut it down and tell you what it left.
- `exclusions` — the review's list of generated and build-output paths. Each fixer is told never to stage one, because a
  regenerated bundle buries the change it is supposed to be showing: in one run four independent fixes each rebuilt
  `dist/server.cjs`, and one of the resulting commits touched 25 files to express a one-line source change.
- `reviewedCommit` — the commit the findings were written against. The script does *not* fix that commit; it fixes
  current `HEAD`. This value is passed so each fixer can be told how far the tree has moved, and so the report can say
  the same to you.

## Run the workflow

Call the `Workflow` tool with:

- `name` — the string `repo-review-fix`, and nothing else. Reference the workflow by name rather than by path: the
  harness resolves a named workflow out of your Claude config directory itself, honouring `CLAUDE_CONFIG_DIR` and
  falling back to `~/.claude`, so a hardcoded path would be wrong on any machine that does not set that variable the
  same way. Do not substitute `scriptPath` — some sessions restrict this tool to named workflows and refuse a path.
- `args` — aim for an **actual JSON object**: `args: { "severity": "high" }`, not `args: "{\"severity\": \"high\"}"`. In
  practice this call site has been observed to deliver the object JSON-encoded as a string every time, so the script
  parses that form rather than trusting the shape; you therefore do not need to work around it. Do not write a shim
  workflow to route past it, and do not deliberately send a string — one that is not valid JSON cannot be recovered, and
  the script then aborts with a gap rather than fixing anything.

  Build it from the three ledger keys above plus **only the flags the user actually supplied**. The script fills in every
  documented default (`--severity low`, `--max-fixes 5`, `--reviewers 1`, `--effort high`), so do not synthesise
  defaults here, and never include `--output`.

Before you call it, state in one line what you are about to spend: how many findings the ledger holds, the floor and cap
in force, and therefore roughly how many findings will be attempted — e.g. "31 findings in the ledger, fixing up to 5 at
`high` or above." Then launch. Running that workflow *is* the fixing: it runs in the background and returns a structured
result when it finishes. Do not fix anything yourself, do not launch fix agents outside it, and do not re-run it while it
is in flight. Watch progress in `/workflows`.

The result is `{ base, reviewedCommit, considered, selected, sandboxBranches, keepBranches, outcomes, gaps }`:

- `base` — the commit every fix is parented on: the `HEAD` the survey read before any agent ran. It is `null` when the
  run refused, which is the one outcome that needs explaining rather than reporting; see below.
- `reviewedCommit` — echoed back from the ledger, or `null` if it was unusable.
- `considered` — how many findings you passed. `selected` — how many the floor and the cap admitted. When they differ the
  script has already said so in `gaps`; the two numbers are what make the gap checkable.
- `outcomes` — one entry per selected finding, in the order they were attempted (worst first), each carrying the
  finding's `fingerprint`, `description`, `category`, `severity`, `file` and `lines`, plus the fix's `status`, `sha`,
  `branch`, `changedFiles` and `reason`. `status` is one of:

  | `status`             | what happened                                              | branch holds |
  |----------------------|------------------------------------------------------------|--------------|
  | `applied`            | fixed, verified, and the reviewers agreed                  | a commit     |
  | `review-rejected`    | fixed and verified, but the reviewers objected             | a commit     |
  | `declined`           | the fixer judged it not safely fixable and changed nothing | nothing      |
  | `verify-failed`      | the fix broke the build or tests and was reverted          | nothing      |
  | `resolved-elsewhere` | the defect was no longer there                             | nothing      |

- `sandboxBranches` — every branch the run created, which is the teardown list. `keepBranches` — the subset the script
  believes carries a commit. Both are **self-reported by the agents**; the script has no git access. Verify them.
- `gaps` — everything the run could not do. Report every one of them verbatim. This is not boilerplate: the failure this
  whole design guards against is a run that looks complete and is not, and a gap is the only place that shows.

**If `base` is `null`, no fix was attempted.** The script refuses to fix rather than fix the wrong tree: a sandbox
worktree is created at the *remote* default branch, not local `HEAD` — 126 commits behind, in one observed run — so
without a SHA to pin to, the fixers would edit stale source and return branches described as fixes for code they were
never written against. Report the gap, leave the ledger untouched, and suggest re-running. There is nothing to tear down.

## Report the branches

Each fix already exists as a commit on a branch of its own, made by an agent in an isolated worktree. **You do not land
it.** You do not cherry-pick, merge, rebase, switch, edit a file, resolve a conflict, or amend a commit: you verify what
exists, report it, and delete only the sandboxes that hold nothing.

That is the opposite of what the `--fix` phase used to do, and the reversal was deliberate. Landing meant cherry-picking
every fix onto one branch, which is sound only if the fixes are pairwise-disjoint in their files — an invariant no script
here can verify, since "disjoint" is only ever what the fix agents *said* — and one that real runs broke twice over: four
fixes each rebuilt `dist/server.cjs`, and a shared allowlist that two separate fixes both had to touch produced a
"disjoint" pair that passed apart and failed together. Enforcing disjointness meant *discarding real fixes* to protect a
merge nobody had asked for. So fixes are additive and independent — one branch each, freely overlapping — and whoever
wants two of them together does that deliberately, with the conflict in front of them.

1. **Note where the repository is.** Run `git rev-parse HEAD` and compare it with `base`. If they differ the checkout has
   moved since the fixes were made; say so, and say how far, but do not treat it as a failure — nothing is being applied,
   so a moved `HEAD` costs the user a rebase rather than costing correctness. Say separately how far `base` is from
   `reviewedCommit` when those differ: that is the drift between what was reviewed and what was fixed, and it is why a
   finding may have come back `resolved-elsewhere`. You do **not** need a clean working tree for any of this, and must
   not stash, commit, or check anything out to get one.
2. **Verify every branch against git before you name it.** For each entry in `keepBranches`, and each distinct
   `outcome.branch` that came back with a `sha`, run `git rev-parse <branch>` and `git rev-parse <branch>^`. The branch
   must resolve, and its first parent must be `base`. A branch that does not resolve, or that resolves *to* `base`,
   carries no commit at all: the agent reported a fix it never made. That is a **defect in the run**, not an unfixable
   finding — say so plainly, and count the finding as not fixed. A branch whose parent is some other commit still holds
   work; keep it, but say the base is not the one the run claimed.
3. **Report a table**, one row per branch that verified, most severe first:

   | branch | commit | severity | category | file | fix status |
   |---|---|---|---|---|---|

   Abbreviate the `sha` from the outcome, and give the finding's description in the row or immediately beneath it.
   Include the `review-rejected` rows, marked as such and with the objection from `reason`: the commit exists, and
   reading it is precisely how the user judges whether the objection was right. A rejection is an opinion, not a proof.

   Then say once, plainly, that these branches are **unmerged**: nothing has been applied to the working checkout, they
   are all cut from `base`, and two of them may well touch the same file, so taking more than one is a deliberate act
   that may need a conflict resolved. Point the user at `git diff <base-sha>..<branch>` to read one and
   `git cherry-pick <sha>` to take one, spelling out the real SHAs. Those are suggestions *for the user to run* — they
   are not in your `allowed-tools`, and you do not run them.

   Then account for the findings with no row: how many were `declined`, `verify-failed` or `resolved-elsewhere`, with the
   `reason` for each. A declined finding is a judgement worth reading — it usually names why the fix is not mechanical —
   and a `verify-failed` one is a fix that was attempted and broke something, which is different information again.

4. **Tear down only the empty sandboxes.** Every worktree goes; a branch goes only if it holds nothing. This inversion is
   the whole point: a branch *is* the product of this command, so the failure to avoid is deleting one that holds work,
   not leaving an empty one behind. When in doubt, keep it and say you did — a stray `rrfix/*` ref costs nothing, and
   per-run branch names mean a leftover cannot break the next run. (They are per-run for exactly that reason: the fixers
   used to restart at `rrfix/0` every time, and one run ending without teardown made the next run's
   `git switch --create rrfix/0` fail outright.)
   - **Worktrees first, all of them.** A branch checked out somewhere cannot be deleted, and a branch you are keeping
     does not need its worktree — the commit lives in the repository, not in the checkout. For each entry in
     `git worktree list --porcelain` whose `branch` is one of `sandboxBranches` *or* is a `worktree-<run-id>-<n>` branch
     for this run's `<run-id>`, run `git worktree remove <path>`, adding `--force` if it refuses: the commit is what you
     reported, and anything else left in the sandbox is scratch. Match both forms, because a fixer only moves onto its
     `rrfix/*` ref once it has run its own `git switch --create`: one that died before that leaves a sandbox still
     checked out on the `worktree-<run-id>-<n>` ref the harness made it on, which the `rrfix/*` refs alone never match.
     Miss it and both the worktree and that branch leak — the branch delete below cannot touch a ref that is checked out,
     and `git worktree prune` only drops administrative files for worktrees whose directory is already gone.
   - **Then delete `sandboxBranches` minus everything step 2 found carrying a commit.** That is `keepBranches` plus any
     branch you found ahead of `base` that was not on it — the script reports from the agents' self-report, so git is the
     authority here and it overrules the list in the keep direction only. Never in the delete direction: a branch missing
     from `keepBranches` that turns out to hold a commit is exactly the agent that committed and then died before
     reporting back, and its branch is the only copy of that work.
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
   - You still need a single `<run-id>` for the `worktree-<run-id>-<n>` refs, because those are *not* on the list and can
     only be matched by pattern. Take the one appearing in the **most** `sandboxBranches` entries rather than the one in
     the first entry, and ignore `undefined` / `null` outright. When the names disagree the script says so in `gaps`;
     expect `worktree-*` refs under the minority ids to survive teardown, and report them as leftovers rather than
     widening the pattern to catch them. The harness does not reap those refs itself — they are what the fix branches
     were cut from — so delete the ones for this `<run-id>` (the worktree step above has already released any sandbox
     still checked out on one), then finish with `git worktree prune` to drop the stale administrative files.
     **Never glob `worktree-*`.** That namespace belongs to every worktree-isolated agent in the session, not just this
     run, so an unscoped delete destroys unrelated work; match on this run's `<run-id>` and nothing else.

   Touch nothing this run did not create, and never reconstruct either set from a guess: for the `rrfix/*` refs that
   means deleting only names that appear in `sandboxBranches`; for the `worktree-*` refs, which are not listed, only the
   majority `<run-id>` read out of those names.

Do not push, and do not open a pull request. Do not merge the branches anywhere, including into each other. Do not create
GitHub issues or post comments. The *only* actions this command takes are the read-only verification above, the teardown
of the empty sandboxes it created, and the two file writes below.

## Update the ledger

Write the file back with `Write` after reporting, and make exactly two changes to it. Everything else — every other
finding, every `firstSeen`, `round`, `scope`, `version` — is carried through untouched. This command does not review, so
it has no business rewriting what the review recorded.

1. **Drop every finding whose outcome was `resolved-elsewhere`**, matched by `fingerprint`. The fixer opened the file and
   the defect was not there: it was fixed by hand, subsumed by an earlier batch, or the code was deleted. Keeping it
   means every future run pays a fixer to rediscover that there is nothing to fix, forever, because nothing else will
   ever retire it. This is the one thing that shrinks the ledger, and it is why the status exists.
2. **Record a `fixBranch` on every finding whose outcome carries a verified commit** — the `applied` and
   `review-rejected` ones, keyed by `fingerprint`, holding the branch name and the abbreviated SHA. A finding with one is
   still open, and is deliberately still offered to the next run: nothing has been landed, so the defect is still in the
   tree. What the key buys is that the next report can say a branch already exists for it, so the user is not handed a
   second fix for a finding they have an unmerged fix for.

Set `updatedAt` to the current time. Do **not** touch `reviewedCommit` or `round`: they describe the review, and no
review happened here. Writing `base` into `reviewedCommit` would tell the next run that the current tree has been
reviewed when it has not, which silently suppresses everything a real review of it would find.

If nothing changed — no finding was retired and none got a branch — do not write the file at all, and say so. An
`updatedAt` bump on an otherwise identical file is a diff that claims something happened.

The two files this command writes are not exceptions to the read-only posture above. `--output` writes where the user
pointed it, and the ledger is these commands' own state, at a fixed path. Neither is a source file and neither is
committed — if the user does not want the ledger tracked, `.claude/` belongs in their `.gitignore`, which is their
decision and not one to make for them.

## Notes

- The script sets each agent's `model` tier (`haiku`/`sonnet`/`opus`) and its `effort`, and caps the per-finding agents at
  `xhigh`, clamping `max` down. That cap is a deliberate reliability tradeoff: launching many concurrent `max` Opus
  inferences has been observed to intermittently stall — an agent gets its tool result and its next turn never arrives —
  and a stall is silent, with no timeout to recover from. Hence watching `/workflows`.
- The fixers for the high-risk categories (`architecture`, `bug`, `consistency`, `security`) run on Opus and the rest on
  Sonnet, with each fix reviewed at its fixer's tier. You do not choose this; it is in the script.
- Everything the script reports about its own commits is **self-reported** by agents it cannot verify, because a workflow
  script has no git access. That is the whole reason step 2 above exists, and why git overrules the report in the keep
  direction. Do not skip it because the numbers look consistent — a fix agent claiming `applied` for a commit it never
  made is the exact failure it catches, and it is consistent with itself.
- Nothing here re-examines a finding before fixing it beyond the fixer's own step 1, and nothing re-reviews the tree
  afterwards. A run of this command tells you what it changed on branches; it does not tell you the repository is now
  clean. `/repo-review` is what does that, and it should be run again after you merge anything.
