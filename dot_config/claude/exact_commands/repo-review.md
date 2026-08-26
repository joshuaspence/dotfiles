---
name: Repo Review
description: Review an entire repository
argument-hint: >-
  [path]
  [--effort <low|medium|high|xhigh|max>]
  [--breadth <n|auto>] [--depth <n|auto>]
  [--loop [<max-rounds>]
  [--fix]
  [--reviewers <n>]
  [--output <file>]
allowed-tools:
  - Bash(git branch:*)
  - Bash(git cherry-pick:*)
  - Bash(git log:*)
  - Bash(git remote:*)
  - Bash(git rev-parse:*)
  - Bash(git switch:*)
  - Workflow
  - Write
---

Provide a code review for an entire repository.

The review runs as a committed **workflow** — `~/.config/claude/workflows/repo-review.js` — which fans it out across
subagents (survey → partition → review → dedup → validate) and returns validated findings. This command is a thin
wrapper: parse the arguments below, run that script via the `Workflow` tool, and format what it returns. The algorithm
itself — the phases, the per-step model tiers, the effort cap, the strict-majority rule, and the reviewer instructions —
lives in the script; do not re-implement it here, and do not launch review subagents any other way.

## Parse arguments

The arguments to this command are: `$ARGUMENTS`. Parse them as follows.

**Invariant — account for every token.** Every token in `$ARGUMENTS` is exactly one of three things: a `--flag`, a value
belonging to the `--flag` immediately before it, or the `path`. There is no fourth category and there is no token you
may ignore. So: if a token is not a flag and not a preceding flag's value, it **is** the `path` — carry it through to
`args`. Dropping it is not a harmless omission; it silently widens the review from one subtree to the entire repository,
every phase then behaves correctly for that wider scope, and nothing downstream can detect the mistake. Adding a flag
never removes the `path`: `path` is independent of `--fix`, `--output`, and every other flag, and combining them does
not make it optional.

- A bare `path` argument is an optional path that scopes the review to a subtree. If absent, review the whole
  repository. When given, it applies throughout the script (survey, partition, and the per-unit reviewers cover only
  that subtree; the architecture lenses still read the whole repo but report only defects involving it). Include it as
  `path` when given; omit it when absent (the script then reviews the whole repository).
- `--effort <low|medium|high|xhigh|max>` sets the requested reasoning effort for the workflow's subagents. If omitted,
  the script uses `high`. Reject any other value and stop with an error rather than guessing. When given, pass it
  through unchanged — the script itself caps the high-fan-out agents at `xhigh` (see [Notes](#notes)); you do not clamp
  it here.
- `--breadth <n|auto>` sets how many coherent review units the repository is partitioned into. Must be a positive
  integer or `auto`; reject any other value and stop with an error rather than guessing. If omitted, the script defaults
  it to `auto`, which lets the partitioner choose within a range the script scales to how many files are actually in
  scope — so a narrow `path` argument does not fan out as though it were the whole repository. Pass an explicit `n` to
  override that sizing in either direction.
- `--depth <n|auto>` sets how many independent validators run per issue. Must be a positive integer or `auto`; reject
  any other value and stop with an error rather than guessing. If omitted, the script defaults it to `1` — do not pass
  `auto` yourself; `auto` applies only when the user explicitly asks for it. A fixed `n > 1` keeps an issue only on a
  strict majority of its validators (≥2 of 3, ≥3 of 5); `auto` scales the count by risk (more for bugs, security,
  consistency, and architecture; a single validator for code-quality, test-critique, and `CLAUDE.md`). The script
  applies this rule — you only pass the value through.

  `--breadth` and `--depth` are orthogonal to `--effort`: they scale how many agents run and how many times findings are
  challenged, whereas `--effort` scales how hard each individual agent thinks.

- `--loop [<max-rounds>]` turns on multi-round *loop-until-dry* reviewing. The script repeats its review-and-dedupe
  pass, accumulating de-duplicated findings and steering later rounds toward what earlier ones missed, and stops as soon
  as a round surfaces nothing new (or when it reaches the cap). Bare `--loop` uses the script's default cap; an explicit
  positive integer overrides that cap. Must be a positive integer when given; reject any other value and stop with an
  error rather than guessing. If omitted, the script runs a single pass. Pass it as `loop`: `true` for a bare flag, or
  the integer when one is given. `--loop` is a third, orthogonal axis: `--effort` scales how hard each agent thinks,
  `--breadth`/`--depth` scale how many agents run and how often findings are challenged, and `--loop` scales how many
  times the whole review repeats.

- `--fix` (boolean, no value) makes the review **act**: after validation, the script runs its Fix, Review, and Reconcile
  phases — one isolated agent per validated finding attempts a clean, verified fix and commits it, those fixes are
  independently reviewed (see `--reviewers`), and a reconciliation agent merges any surviving fixes that collide on a
  shared file — and returns a conflict-free list of commits plus a per-finding outcome. This command then lands those
  commits on a dedicated branch (see [Apply fixes](#apply-fixes)). If omitted, the review is strictly read-only, as
  before. Pass it as `fix`: `true` when present; omit it otherwise. `--fix` is independent of the other flags (it fixes
  whatever the review, at whatever breadth/depth/effort/loop, validated).

- `--reviewers <n>` sets how many independent reviewers judge each fix in the Review phase (only meaningful with
  `--fix`). Must be a non-negative integer; reject any other value and stop with an error rather than guessing. If
  omitted, the script defaults it to `1`. A fix is kept only on a **strict majority** of its reviewers; a rejected fix
  is sent back to the fixer with the objection and re-reviewed, up to an internal revision cap, before being reported
  unfixed. **`--reviewers 0` disables the Review phase entirely** — applied fixes go straight to reconciliation, as
  they did before this phase existed. Pass it through as `reviewers` when given; omit it otherwise. This is to *fixes*
  what `--depth` is to *findings*.

- `--output <file>` writes the report to that file in addition to the terminal. This command handles it; do **not** pass
  it to the script. It is the only flag you parse and then deliberately withhold — every other flag is either passed
  through or absent — so take care that consuming `--output` and its filename does not also consume the `path`.

## Run the workflow

Call the `Workflow` tool with:

- `scriptPath` — the absolute path of `~/.config/claude/workflows/repo-review.js` (expand `~` to your home directory;
  the tool needs an absolute path, and the script lives under your config dir, not in the repository being reviewed).
- `args` — a JSON object built from **only the flags the user actually supplied**: add a key for each flag the user
  gave, and omit the rest. The script fills in the documented defaults for anything omitted (whole repository,
  `--effort high`, `--breadth auto`, `--depth 1`, a single review pass), so do not synthesise default values here, and
  never include `--output`. Worked examples — note that a `path` survives every flag combination, and that the two
  path-less rows are path-less only because the user gave no path:

  | Invocation                                            | `args`                                              |
  |-------------------------------------------------------|-----------------------------------------------------|
  | `/repo-review`                                        | `{}`                                                |
  | `/repo-review src --breadth 6`                        | `{ "path": "src", "breadth": 6 }`                   |
  | `/repo-review --loop`                                 | `{ "loop": true }`                                  |
  | `/repo-review src --loop 3`                           | `{ "path": "src", "loop": 3 }`                      |
  | `/repo-review --fix`                                  | `{ "fix": true }`                                   |
  | `/repo-review --fix --reviewers 2`                    | `{ "fix": true, "reviewers": 2 }`                   |
  | `/repo-review src/a.js --fix`                         | `{ "path": "src/a.js", "fix": true }`               |
  | `/repo-review src/a.js --output report.md`            | `{ "path": "src/a.js" }`                            |
  | `/repo-review src/a.js --fix --output report.md`      | `{ "path": "src/a.js", "fix": true }`               |
  | `/repo-review pkg --effort xhigh --fix --output r.md` | `{ "path": "pkg", "effort": "xhigh", "fix": true }` |

Before you call `Workflow`, state in one line the `args` object you built and the scope it implies — e.g. "Reviewing
`src/a.js` (scoped) with `--fix`." — then check it against `$ARGUMENTS`: every non-flag token must appear as `path`. If
you wrote "whole repository" but the user gave a path, you have dropped it; fix `args` before launching. Finalise every
argument value *before* you call `Workflow`. Running that workflow *is* the review: it runs in the background and
returns a structured result when it finishes. Do not launch review subagents outside it, do not re-run it while it is in
flight, and — importantly — do not stop and restart it merely to change a default or an argument you could have set at
launch (a run already under way is not wrong just because you could have passed, or omitted, a value explicitly). The
only reason to stop a run is a genuine wedge — most agents done, a few idle for many minutes — after which you may
re-run, watching progress in `/workflows`, optionally at a lower `--effort`.

The result is `{ findings, exclusions, gaps }`:

- `findings` — validated issues. Each has `description`, `severity` (`critical`/`high`/`medium`/`low`), `category`,
  `file`, `lines` (may be empty), `otherSites` (other affected `file:line` or modules, may be empty), and `reason`.
- `exclusions` — `{ path, reason }` entries for everything the partitioner left out (vendored/third-party code,
  generated code, lock files, binaries).
- `gaps` — strings naming any reviewer, lens, or validation that did not complete, plus (when `--loop` is used) a note
  if the loop hit its round cap without going dry — a signal that more findings may exist.
- `fix` — present **only when `--fix` was requested** and there were findings. It is `{ commits, outcomes }`:
  - `commits` — a conflict-free, ordered list of `{ sha, changedFiles, findingCount }` to cherry-pick. Every commit
    touches a disjoint set of files and is based on the review's `HEAD`, so the cherry-picks below cannot conflict.
  - `outcomes` — one entry per finding: `{ description, category, severity, file, lines, status, sha, reason }`, where
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
  and `CLAUDE.md` compliance."
- In both cases, state which parts of the repository were excluded (`exclusions`), and report every entry in `gaps` as
  **not reviewed / not validated** — a dropped reviewer, lens, or validation must not read as "clean".
- When a `fix` object is present, annotate each finding with its outcome from `fix.outcomes` (fixed, or the reason it
  was not), and after applying the commits (below) report the branch name and a tally: how many findings were fixed
  (`applied` + `conflict-resolved`) versus left unfixed (`declined` / `verify-failed` / `review-rejected` /
  `conflict-skipped`). An unfixed finding must never read as fixed.

If `--output <file>` was provided, write the same report to that file.

## Apply fixes

Only when a `fix` object was returned. The commits already exist as objects in the repository (each Fix/Reconcile
agent committed on its own branch in an isolated worktree); your job is only to land them on a review branch — you do
**not** edit files or resolve conflicts, because `fix.commits` is already conflict-free.

1. Create a dedicated branch off the current `HEAD` and switch to it: `git switch -c repo-review-fixes` (if it already
   exists, use a numbered suffix, e.g. `repo-review-fixes-2`, rather than clobbering it).
2. Cherry-pick each `sha` in `fix.commits`, in order: `git cherry-pick <sha>`. These cannot conflict by construction;
   if one unexpectedly does, `git cherry-pick --abort`, stop landing further commits, and report the remaining ones as
   **not applied** rather than forcing a resolution.
3. Switch back to the original branch (`git switch -`) so the user's working checkout is left as it was, with the
   fixes isolated on `repo-review-fixes` for them to review and merge.

Do not push, and do not open a pull request — landing the commits on the local branch is where this stops.

Without `--fix`, this command only reports: do not create GitHub issues, do not post comments, do not edit files, and
do not commit anything. With `--fix`, the *only* action it takes is the branch-and-cherry-pick above — it still does
not push, comment, or open PRs.

## Notes

- The script enforces what this command depends on, so you do not manage it here: it sets each agent's `model` tier
  (`haiku`/`sonnet`/`opus`) and its `effort`, and it caps the high-fan-out reviewers and validators at `xhigh`, clamping
  `max` down. That cap is a deliberate reliability tradeoff — those agents run at high multiplicity (roughly `--breadth`
  × 6 reviewers, plus validators per issue), and launching that many concurrent `max` Opus inferences has been observed
  to intermittently stall (an agent gets its tool result and its next turn never arrives). Because the review phase is a
  `parallel()` barrier, one hung agent can wedge the run; the cap keeps the many leaf agents off `max`, the only level
  observed to stall. A *silent* hang has no timeout to recover from — hence watching `/workflows` above.
- The Review phase costs roughly `units × 6 reviewers`, plus 3 architecture lenses, per round — so the unit count is
  the dominant cost lever. The script sizes it from the survey's file counts (see `--breadth`) and, on a scope of two
  files or fewer, skips the three whole-repo architecture lenses entirely, recording that skip in `gaps`. Report it like
  any other gap: architecture was **not reviewed**, not "clean".
- The script resolves failures it can see: each fan-out runs under `parallel()`, which resolves a failed agent to
  `null` rather than rejecting the batch, and every dropped reviewer, lens, or validation is recorded in `gaps`. Surface
  those gaps in the output.
- With `--loop`, only the review-and-dedupe phases repeat; the survey and partition run once (stable context — and
  re-partitioning between rounds would move findings and defeat cross-round dedup), and validation runs once at the end
  over the accumulated set. Later rounds are told which findings are already known and are pushed to look elsewhere, so
  cost grows roughly per round until the run goes dry or hits the cap. Because looping multiplies the high-fan-out
  review phase, watch `/workflows` as with any long run.
- With `--fix`, the Fix phase adds one worktree-isolated agent **per validated finding**, each of which edits and then
  runs the repository's typecheck/tests in its sandbox before committing — the expensive-and-slow part. A fixer commits
  only a clear, safe, localized change that still passes; otherwise it declines or reports a verify failure, and that
  finding is reported unfixed. In-sandbox verification silently degrades to "commit the edit" when the repository has
  no runnable test suite, so the `repo-review-fixes` branch plus your own review is the real safety net. Fixes land on
  that branch only; nothing touches your working checkout or is pushed.
- The Review phase (unless `--reviewers 0`) adds, per applied fix, `--reviewers` read-only reviewers that judge the
  diff for correctness and quality — the thing the in-sandbox tests can't. A fix rejected by a majority is handed back
  to a fresh fixer with the objection and re-reviewed, up to an internal cap of two revisions, then reported
  `review-rejected` if it still fails. Only review-approved fixes reach reconciliation, so a rejected fix can't drag an
  unrelated finding into a file collision. Cost is roughly `findings × up-to-3 fix attempts` (the expensive worktree +
  test runs) plus `findings × up-to-3 review rounds × --reviewers` (cheaper read-only reviewers); `--reviewers 0` skips
  the review cost entirely and restores the pre-Review behaviour.
- `allowed-tools` governs only this wrapper — running the workflow, landing the fix commits, and formatting the result
  — not the subagents the workflow launches. Those carry their own default tool pool, so reviewers and validators can
  `Read`, `Grep`, `Glob`, and `git ls-files`, and the `--fix` agents can `Edit` and commit in their own worktrees,
  regardless of this list; you neither need to nor can provision their tools from here. This list is therefore minimal:
  `Workflow` to run the review, `Write` for `--output`, the two read-only `git` commands used to build permalinks, and
  the `git switch`/`branch`/`cherry-pick`/`log` commands used to land `--fix` commits on the review branch.
- Cite each finding with a file path and line range, and link it if the repository has a GitHub remote. Follow this
  format precisely, otherwise the Markdown preview won't render correctly:
  https://github.com/anthropics/claude-code/blob/c21d3c10bc8e898b7ac1a2d745bdc9bc4e423afe/package.json#L10-L15

  - Requires the full commit SHA; obtain it with `git rev-parse HEAD`.
  - Repo name must match the repo you're reviewing. Get the remote with `git remote get-url origin`; it may be in SSH
    form (`git@github.com:owner/repo.git`), which you must convert to `https://github.com/owner/repo`.
  - `#` sign after the file name.
  - Line range format is `L[start]-L[end]`. Single line format is `L[number]`.
- If the repository has no GitHub remote, cite findings as `path/to/file.ext:12-18` instead.
