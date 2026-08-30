---
name: Repo Review
description: Review an entire repository
argument-hint: >-
  [--effort <low|medium|high|xhigh|max>]
  [--fix]
  [--loop [<max-rounds>]]
  [--output <file>]
  [--partitions <n|auto>]
  [--reviewers <n>]
  [--validators <n|auto>]
  [path ...]
allowed-tools:
  - Bash(git branch --show-current)
  - Bash(git branch --delete --force:*)
  - Bash(git checkout --:*)
  - Bash(git cherry-pick:*)
  - Bash(git remote get-url:*)
  - Bash(git rev-parse:*)
  - Bash(git show:*)
  - Bash(git status:*)
  - Bash(git switch -)
  - Bash(git switch --create repo-review-fixes)
  - Bash(git worktree list:*)
  - Bash(git worktree prune:*)
  - Bash(git worktree remove:*)
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

- `--loop [<max-rounds>]` turns on multi-round *loop-until-dry* reviewing. The script repeats its review-and-dedupe
  pass, accumulating de-duplicated findings and steering later rounds toward what earlier ones missed, and stops as soon
  as a round surfaces nothing new (or when it reaches the cap). Bare `--loop` uses the script's default cap; an explicit
  positive integer overrides that cap. It is the only flag whose value is optional, so it needs its own rule for telling
  that value from a `path`: **`--loop` consumes the token after it only when that token begins with a digit.** Otherwise
  `--loop` is bare and that token is parsed on its own terms — as a flag, or, per the invariant above, as a path. So
  `/repo-review --loop src` is `{ "loop": true, "paths": ["src"] }`: neither a parse error nor a dropped path. A token it
  does consume must be a positive integer; reject anything else (`--loop 0`, `--loop 2.5`) and stop with an error rather
  than guessing. That is also why a path whose name begins with a digit cannot follow a bare `--loop` — write it before
  the flag instead. If omitted, the script runs a single pass. Pass it as `loop`: `true` for a bare flag, or the integer
  when one is given. `--loop` is a third, orthogonal axis: `--effort` scales how hard each agent thinks,
  `--partitions`/`--validators` scale how many agents run and how often findings are challenged, and `--loop` scales how
  many times the whole review repeats.

- `--fix` (boolean, no value) makes the review **act**: after validation, the script runs its Fix, Review Fix, and
  Reconcile phases — one isolated agent per validated finding attempts a clean, verified fix and commits it, those fixes
  are independently reviewed (see `--reviewers`), and a reconciliation agent merges any surviving fixes that collide on
  a shared file — and returns a list of commits plus a per-finding outcome. This command then verifies those commits
  against git and lands the ones that check out, on a dedicated branch (see [Apply fixes](#apply-fixes)). If omitted,
  the review is strictly read-only, as before. Pass it as `fix`: `true` when present; omit it otherwise. `--fix` is
  independent of the other flags (it fixes whatever the review, at whatever partitions/validators/effort/loop,
  validated).

- `--reviewers <n>` sets how many independent reviewers judge each fix in the Review Fix phase (only meaningful with
  `--fix`). Must be a non-negative integer; reject any other value and stop with an error rather than guessing. If
  omitted, the script defaults it to `1`. A fix is kept only on a **strict majority** of its reviewers; a rejected fix
  is sent back to the fixer with the objection and re-reviewed, up to an internal revision cap, before being reported
  unfixed. **`--reviewers 0` disables the Review Fix phase entirely** — applied fixes go straight to reconciliation, as
  they did before this phase existed. Pass it through as `reviewers` when given; omit it otherwise. This is to *fixes*
  what `--validators` is to *findings*.

- `--output <file>` writes the report to that file in addition to the terminal. This command handles it; do **not** pass
  it to the script. It is the only flag you parse and then deliberately withhold — every other flag is either passed
  through or absent — so take care that consuming `--output` and its filename does not also consume a `path`. Its
  filename is the value of the flag before it and is therefore never one of the `paths`, however path-like it looks.

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
  `--partitions auto`, `--validators 1`, a single review pass), so do not synthesise default values here, and never
  include `--output`. Worked examples — note that every `path` survives every flag combination, and that the path-less
  rows are path-less only because the user gave no path:

  | Invocation                                            | `args`                                                 |
  |-------------------------------------------------------|--------------------------------------------------------|
  | `/repo-review`                                        | `{}`                                                   |
  | `/repo-review src --partitions 6`                     | `{ "paths": ["src"], "partitions": 6 }`                |
  | `/repo-review src lib`                                | `{ "paths": ["src", "lib"] }`                          |
  | `/repo-review --loop`                                 | `{ "loop": true }`                                     |
  | `/repo-review src --loop 3`                           | `{ "paths": ["src"], "loop": 3 }`                      |
  | `/repo-review src lib --loop 3`                       | `{ "paths": ["src", "lib"], "loop": 3 }`               |
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

The result is `{ reviewedCommit, findings, exclusions, gaps }`:

- `reviewedCommit` — the commit SHA the review was defined against: the `HEAD` the survey read before any agent ran.
  Cite this in permalinks (see the format below) rather than asking git for `HEAD` yourself — a long run can outlive the
  `HEAD` it started on, and links built from a moved `HEAD` point at text no reviewer saw. It is `null` only when the
  survey never reported it, which is the one case where you fall back to `git rev-parse HEAD`.
- `findings` — validated issues. Each has `description`, `severity` (`critical`/`high`/`medium`/`low`), `category`,
  `file`, `lines` (may be empty), `otherSites` (other affected `file:line` or modules, may be empty), and `reason`.
- `exclusions` — `{ path, reason }` entries for everything the partitioner left out (vendored/third-party code,
  generated code, lock files, binaries).
- `gaps` — strings recording every way the run fell short of a complete, clean pass. They come in three kinds, and each
  entry states in prose which it is:

  - **coverage** — a reviewer, lens, or validation that did not complete, or (with `--loop`) the loop hitting its round
    cap without going dry. Findings may be *missing*.
  - **dedupe** — a dedupe stage that stalled or did not converge. Every finding here *was* reviewed and validated; one
    defect may simply be listed twice.
  - **fix** — present only with `--fix`: a fix that could not be produced, reviewed, verified or landed. This is about
    landing work, not review coverage.
- `fix` — present **only when `--fix` was requested** and there were findings. It is
  `{ base, sandboxBranches, commits, outcomes }`:
  - `base` — the commit SHA every commit in `commits` should be parented on: `reviewedCommit` again, under the name the
    pre-flight checks it by. You verify this rather than assume it (see [Apply fixes](#apply-fixes)).
  - `sandboxBranches` — every branch the run's fix and reconcile agents reported creating, successful or not, plus the
    branch each agent that never reported back was told to create: one killed mid-run had already cut its branch as its
    first step, and an unrecorded branch is one teardown cannot remove. This is the teardown list; it exists because
    those branches, not a naming glob, are what this run is responsible for. A reconstructed entry may name a branch
    that was never actually created (the agent died before creating it), so a "not found" while deleting one is expected
    and not a failure.
  - `commits` — an ordered list of `{ sha, branch, changedFiles, findingCount }` to cherry-pick. The script intends
    these to be pairwise-disjoint in their files and all parented on `base`, and it drops any commit it can prove
    otherwise — but it has no git access, so every check it made ran on the agents' *self-reported* file lists. Treat
    the list as a proposal to verify, not a guarantee to rely on.
  - `outcomes` — one entry per finding:
    `{ description, category, severity, file, lines, status, sha, branch, reason }`, where
    `status` is `applied` (fixed and committed), `conflict-resolved` (merged with other fixes into one commit),
    `declined` (not a safe, localized fix), `verify-failed` (the fix broke the build/tests in its sandbox),
    `review-rejected` (reviewers rejected the fix and revisions were exhausted), or `conflict-skipped` (collided and
    reconciliation could not merge it). Only `applied` and `conflict-resolved` are fixed; every other status is an
    **unfixed** finding.

## Produce the output

From the returned result, produce a summary to the terminal, ordered by severity, most severe first (break ties by
putting security and correctness findings ahead of consistency, architecture, code-quality, test, and `CLAUDE.md`
findings):

- If findings were returned, list each with its severity, a brief description, the file and line (or the set of files
  and modules involved, for repository-wide findings), and why it was flagged. Link each to its source with the
  permalink format below, and note any `otherSites`.
- If none were returned, state: "No issues found. Checked for bugs, security, consistency, code quality, architecture,
  test coverage and quality, and `CLAUDE.md` compliance."
- In both cases, state which parts of the repository were excluded (`exclusions`), and report every entry in `gaps` —
  no gap may read as "clean". Label each one by its kind (above), which the entry's own wording tells you: a **coverage**
  gap is **not reviewed / not validated**; a **dedupe** gap was reviewed and validated but may be **reported twice**; a
  **fix** gap is a finding **not fixed** and not verified as unfixable. Do not report a dedupe or fix gap as missing
  review coverage — mislabelling one hides a real gap behind a false alarm.
- When a `fix` object is present, annotate each finding with its outcome from `fix.outcomes` (fixed, or the reason it
  was not), and after applying the commits (below) report the branch name and a tally: how many findings were fixed
  (`applied` + `conflict-resolved`) versus left unfixed (`declined` / `verify-failed` / `review-rejected` /
  `conflict-skipped`). An unfixed finding must never read as fixed.

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

## Apply fixes

Only when a `fix` object was returned. The commits already exist as objects in the repository (each Fix/Reconcile
agent committed on its own branch in an isolated worktree); your job is only to land them on a review branch — you do
**not** edit files, resolve conflicts, or amend commits.

**Verify before you land, and land only what verifies.** The script cannot check its own output: it has no git access,
so "disjoint files, common base" is only ever what the fix agents *told* it. Both halves of that have failed in a real
run — see [Notes](#notes) — so the invariant is re-established here, against git, before the first cherry-pick. Do the
whole pre-flight first: discovering a bad commit at pick 3 of 15 means you have already half-landed the branch and
stranded the twelve behind it.

1. **Pre-flight.** With no branch created and nothing checked out yet:
   - Confirm the working checkout is clean (`git status --porcelain` prints nothing) and note the current branch. If it
     is dirty, land nothing and say so — you must not commit or stash someone else's uncommitted work — then skip
     steps 4 and 5 and go to step 6 rather than stopping here, so the sandboxes are accounted for and not silently left
     behind.
   - Confirm `git rev-parse HEAD` equals `fix.base`. If `HEAD` has moved since the review, every commit's diff was
     authored against different text; land nothing, say the repository moved under the run, and go to step 6 the same
     way.
   - For each `sha` in `fix.commits`, check its parent is the reviewed commit:
     `git rev-parse <sha>^` must equal `fix.base`. A commit that fails this was built on a **stale base** — reject it.
   - For each `sha`, read its real file set with `git show --name-only --format= <sha>` and check it against the
     accumulated set from the commits you have already accepted. Any commit sharing a path with an accepted one is
     rejected. Use the file set git reports, not `changedFiles` — the latter is what a fix agent claimed.
2. **Report the pre-flight** before landing: how many commits passed, and for each rejection which check it failed and
   why (`parent <sha> != base <sha>`, or the overlapping paths and the commit that claimed them). Any commit rejected
   here is a **defect in the run**, not an unfixable finding — say so plainly, and count its findings as not fixed.
3. If nothing passed — no commit was produced at all, or every one was rejected — land nothing, but do **not** stop
   here: skip steps 4 and 5 (there is nothing to pick) and go straight to the cleanup in step 6. The sandboxes exist
   whenever `fix.sandboxBranches` is non-empty, which includes runs where every finding came back unfixed, and stopping
   after the report is what leaks them. Otherwise create a dedicated branch off the current `HEAD` and switch to it:
   `git switch --create repo-review-fixes` (if it already exists, use a numbered suffix, e.g. `repo-review-fixes-2`,
   rather than clobbering it).
4. Cherry-pick the accepted `sha`s in order: `git cherry-pick <sha>`. Pre-flight has established these cannot conflict.
   If one still does, `git cherry-pick --abort`, stop landing further commits, and report the remaining ones as **not
   applied** — never resolve a conflict by hand. Treat it as a pre-flight bug worth reporting: it means git disagreed
   with a check you had already run against git.
5. Switch back to the original branch (`git switch -`) so the user's working checkout is left as it was, with the
   fixes isolated on `repo-review-fixes` for them to review and merge. Then confirm you actually left it as it was:
   `git status --porcelain` must again print nothing. A cherry-pick that changes a tracked file's **mode** can leave
   that mode behind on the original branch even when the content is identical, which is a modified working checkout —
   exactly what this command promises not to do. If anything is dirty, restore those paths
   (`git checkout -- <paths>`) and report that you did.
6. Clean up the run's sandboxes, but **only if every accepted commit landed**. Those branches and worktrees hold the
   only other copy of the work, so if step 4 aborted, skip this entirely and say the sandboxes were left in place. The
   two step-1 exits do the same: they abort over the state of the *repository*, not of the commits, which stay landable
   once the checkout is clean or `fix.base` is checked out again — so delete nothing, and name the branches holding the
   unlanded work so the user can pick them up by hand. That report is the point of routing those exits here.
   Commits *rejected in pre-flight* do not block cleanup by themselves — they are unlandable wherever they sit, so
   note them as discarded and say which branches held them, so the user can salvage one if they want. Accepting
   *nothing* satisfies the condition rather than failing it: run this step even when step 3 sent you straight here.
   - Work from `fix.sandboxBranches`, the branches this run created. **Delete those refs by exact name, not by
     prefix.** The list itself is the authority: the script has already screened every entry into the
     `rrfix/<run-id>/<n>` / `rrmerge/<run-id>/<n>` namespace, so exact-name deletion is inherently scoped to this run
     and cannot reach `master` or a concurrent run's branches. Do not filter the list down to one `<run-id>` before
     deleting — the run id is derived *by each agent* from its own worktree branch, and that derivation has failed in a
     real run: 49 of 116 names came back as `rrfix/undefined/<n>` and one had mis-split the id into
     `wf_6c337c34-fb5-400`. Those branches exist. Prefix-filtering them out of the delete list leaves them behind, which
     is precisely the leak the list is meant to prevent.
   - You still need a single `<run-id>` for the `worktree-<run-id>-<n>` refs below, because those are *not* on the list
     and can only be matched by pattern. Take the one that appears in the **most** entries rather than the one in the
     first entry, and ignore `undefined` / `null` outright. When the names disagree the script says so in `gaps`; expect
     `worktree-*` refs under the minority ids to survive teardown, and report them as leftovers rather than widening the
     pattern to catch them.
   - Worktrees first — a branch checked out somewhere cannot be deleted. For each entry in
     `git worktree list --porcelain` whose `branch` is one of those refs *or* is a `worktree-<run-id>-<n>` branch for
     this `<run-id>`, run `git worktree remove <path>`, adding `--force` if it refuses: the commit is what you landed,
     and anything else left in the sandbox is scratch. Match both forms, because a fixer only moves onto its `rrfix/*`
     ref once it has run its own `git switch --create`: one that died before that leaves a sandbox still checked out on
     the `worktree-<run-id>-<n>` ref the harness made it on, which the `rrfix`/`rrmerge` refs alone never match. Miss it
     and both the worktree and that branch leak — the branch delete below cannot touch a ref that is checked out, and
     `git worktree prune` only drops administrative files for worktrees whose directory is already gone.
   - Then `git branch --delete --force` those same refs. It has to be `--force`, not a safe delete — cherry-picking
     rewrote the SHAs, so git cannot see the originals as merged and `--delete` alone would refuse every one of them.
     Spell both flags out long-form: the `allowed-tools` rule is a literal prefix match on
     `git branch --delete --force`, with no flag aliasing, so the `-D` shorthand misses it and costs you a confirmation
     prompt mid-teardown. A ref git reports as not found is not an error: the list includes the branch an agent that
     never reported back was told to create, and it may have died before creating it. Skip that one and keep going
     through the rest.
   - The harness also leaves a `worktree-<run-id>-<n>` branch per sandbox — the ref the worktree was created on, and
     what the fix branches were cut from. It does not reap those itself, so delete the ones for this `<run-id>` (the
     worktree step above has already released any sandbox still checked out on one), then finish with
     `git worktree prune` to drop the stale administrative files.
     **Never glob `worktree-*`.** That namespace belongs to every worktree-isolated agent in the session, not just this
     run, so an unscoped delete destroys unrelated work; match on this run's `<run-id>` and nothing else.

   Touch nothing this run did not create. Branch names are per-run precisely so that a leftover cannot break the
   next run — the fixers used to restart at `rrfix/0` every time, and a run that ended without teardown made the next
   run's `git switch --create rrfix/0` fail outright. For the `rrfix`/`rrmerge` refs that means deleting exactly the
   names in `fix.sandboxBranches` and nothing else; for the `worktree-*` refs, which are not listed, it means the
   majority `<run-id>` read out of those names and nothing else. Never reconstruct either set from a guess.

Do not push, and do not open a pull request — landing the commits on the local branch is where this stops.

Without `--fix`, this command only reports: do not create GitHub issues, do not post comments, do not edit files, and
do not commit anything. With `--fix`, the *only* actions it takes are the branch-and-cherry-pick above and the cleanup
of the `rrfix/*` and `rrmerge/*` sandboxes it created — it still does not push, comment, or open PRs.

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
  measured `--loop` run the cross pass was handed 116 findings in round 1, 209 in round 2 and 262 in round 3, while the
  largest single unit scope in that entire run was 68, so the fan-in grows with the round count however well the units
  are split. So any scope over 150 findings — under the 163 the top rung was measured answering — is chunked, at either
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
  category still fits, leaving only the `--loop` round tag to overflow, and it numbers slugs that collide
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
- With `--loop`, only the review-and-dedupe phases repeat; the survey and partition run once (stable context — and
  re-partitioning between rounds would move findings and defeat cross-round dedup), and validation runs once at the end
  over the accumulated set. Later rounds are told which findings are already known and are pushed to look elsewhere, so
  cost grows roughly per round until the run goes dry or hits the cap. Because looping multiplies the high-fan-out
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
  no runnable test suite, so the `repo-review-fixes` branch plus your own review is the real safety net. Fixes land on
  that branch only, and nothing is pushed. The working checkout is meant to be left exactly as it was — but that is a
  promise the landing sequence has broken before (a cherry-picked mode change survived the switch back), so step 5 of
  [Apply fixes](#apply-fixes) verifies it rather than assuming it.
- **A fix sandbox is not checked out at your `HEAD`.** `isolation: 'worktree'` creates the worktree on a branch
  `worktree-<run-id>-<n>` pointing at the **remote default branch** — `refs/remotes/origin/master` — not at local
  `HEAD`. In one observed run every one of 81 sandboxes was based 126 commits behind the `HEAD` the reviewers had read.
  Two things followed, and both broke the landing sequence:

  - The fixers read and edited 126-commit-stale source while the findings described current source. No downstream step
    can repair that: a change reasoned about against text that no longer exists is not rebaseable, only discardable.
  - The bases diverged *unpredictably*. Pinning was left to agent initiative, so some fixers noticed the mismatch and
    re-based onto local `master` themselves while most committed straight onto the stale base — four distinct bases
    across one run. "Same base" plus "disjoint files" is what makes the cherry-picks commutative, so scattered bases
    silently void the guarantee.

  The script now pins every sandbox explicitly: the survey captures `git rev-parse HEAD` as `headSha` before any
  worktree exists, and each fix/reconcile agent's first instruction is to `git switch -c <branch> <headSha>` and verify
  the pin took before reading a file. It refuses to run the Fix phase at all if that SHA is unavailable — an unpinned
  fix phase produces confident-looking commits built on the wrong code. The pre-flight in
  [Apply fixes](#apply-fixes) then re-checks the parent of every commit against git, because the script only has the
  agents' word for it. Do not weaken either half: the failure is silent, and it reads as success.
- **Fixes must not commit regenerated build output.** A fix whose verification step rebuilds a tracked artifact and
  stages it collides with every other fix that rebuilt the same artifact. In the run above, four fixes each rebuilt
  `dist/server.cjs`; union-find collapsed all of them into a single reconciliation group whose merged commit then
  touched 25 files, overlapped three unrelated commits, and aborted the landing. The script names the partitioner's
  generated/excluded paths to the fixers as unstageable and refuses any commit that staged one anyway. That mode of
  failure is also where a `100755 → 100644` mode change on `dist/server.cjs` reached the user's working checkout.
- The Review Fix phase (unless `--reviewers 0`) adds, per applied fix, `--reviewers` read-only reviewers that judge the
  diff for correctness and quality — the thing the in-sandbox tests can't. A fix rejected by a majority is handed back
  to a fresh fixer with the objection and re-reviewed, up to an internal cap of two revisions, then reported
  `review-rejected` if it still fails. Only review-approved fixes reach reconciliation, so a rejected fix can't drag an
  unrelated finding into a file collision. Cost is roughly `findings × up-to-3 fix attempts` (the expensive worktree +
  test runs) plus `findings × up-to-3 review rounds × --reviewers` (cheaper read-only reviewers); `--reviewers 0` skips
  the review cost entirely and restores the behaviour from before Review Fix existed.
- `allowed-tools` governs only this wrapper — running the workflow, landing the fix commits, and formatting the result
  — not the subagents the workflow launches. Those carry their own default tool pool, so reviewers and validators can
  `Read`, `Grep`, `Glob`, and `git ls-files`, and the `--fix` agents can `Edit` and commit in their own worktrees,
  regardless of this list; you neither need to nor can provision their tools from here. This list is therefore minimal:
  `Workflow` to run the review, `Write` for `--output`, the two read-only commands `git rev-parse` and
  `git remote get-url` used to build permalinks, the `git rev-parse`/`show`/`status`/`branch --show-current` commands
  used to pre-flight the `--fix` commits against git, and the `git switch`/`branch --delete --force`/`cherry-pick`/
  `worktree`/`checkout` commands used to land them on the review branch, leave the working checkout as it was, and tear
  down the sandboxes they were built in. `git checkout` is there for exactly one purpose — restoring a path the landing
  sequence dirtied (step 5 of [Apply fixes](#apply-fixes)) — and is not a licence to edit files or resolve a conflict.
- Each entry is narrowed to the step that needs it, because prose and a permission pattern are two enforcement layers
  and the pattern wins silently when they disagree: `Bash(git checkout:*)` pre-approved `--ours`/`--theirs`, which is
  resolving a conflict by hand, `Bash(git remote:*)` pre-approved `set-url`, `Bash(git branch:*)` pre-approved
  `--force` (which silently moves a branch and can orphan commits) and `-m`, and `Bash(git switch --create:*)`
  pre-approved a start-point plus `--force` — upstream an alias for `--discard-changes` — so
  `git switch --create repo-review-fixes HEAD~1 --force` exits 0 on a dirty tree and throws the uncommitted work away,
  the one thing step 1 of [Apply fixes](#apply-fixes) stops the whole landing to avoid. None of that is something the
  bullet above claims to allow. Hence `git checkout --:*`, `git remote get-url:*`,
  `git switch --create repo-review-fixes` *and* `git switch -`,
  `git branch --delete --force:*` *and* `git branch --show-current`, and one entry each for `git worktree list`/
  `remove`/`prune`. Only the *refs* the teardown deletes are computed at run time, so pinning the subcommand flag costs
  nothing; `cherry-pick`, `rev-parse`, `show` and `status` are the ones whose arguments are all computed and cannot be
  usefully narrowed. A prefix rule matches only the exact string or the string followed by a space, which is why bare
  `git switch -` and `git branch --show-current` each need a rule of their own —
  `git switch --create repo-review-fixes` and `git branch --delete --force:*` do not cover them — and why
  `git checkout --:*` still permits `git checkout -- .`, so the narrowing is partial. The `git switch --create` rule
  carries no `:*` at all, because a wildcard *anywhere* after `--create` re-admits the `--force` above: the branch name
  is the only argument the command needs, and step 3's numbered-suffix fallback (`repo-review-fixes-2`) consequently
  falls outside the rule and asks once, which is the cheaper half of that trade. It is also hygiene rather than a safety
  boundary: `allowed-tools` is allow-only, so a pattern that stops matching restores a confirmation prompt and never
  removes a capability.
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
