---
name: Repo Review
description: Review an entire repository
argument-hint: '[path] [--effort <low|medium|high|xhigh|max>] [--breadth <n|auto>] [--depth <n|auto>] [--output <file>]'
allowed-tools:
  - Bash(git remote:*)
  - Bash(git rev-parse:*)
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

The arguments to this command are: `$ARGUMENTS`. Parse them as follows:

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
  it to `auto`, which lets the partitioner choose in the range 4–8.
- `--depth <n|auto>` sets how many independent validators run per issue. Must be a positive integer or `auto`; reject
  any other value and stop with an error rather than guessing. If omitted, the script defaults it to `1` — do not pass
  `auto` yourself; `auto` applies only when the user explicitly asks for it. A fixed `n > 1` keeps an issue only on a
  strict majority of its validators (≥2 of 3, ≥3 of 5); `auto` scales the count by risk (more for bugs, security,
  consistency, and architecture; a single validator for code-quality, test-critique, and `CLAUDE.md`). The script
  applies this rule — you only pass the value through.

  `--breadth` and `--depth` are orthogonal to `--effort`: they scale how many agents run and how many times findings are
  challenged, whereas `--effort` scales how hard each individual agent thinks.

- `--output <file>` writes the report to that file in addition to the terminal. This command handles it; do **not** pass
  it to the script.

## Run the workflow

Call the `Workflow` tool with:

- `scriptPath` — the absolute path of `~/.config/claude/workflows/repo-review.js` (expand `~` to your home directory;
  the tool needs an absolute path, and the script lives under your config dir, not in the repository being reviewed).
- `args` — a JSON object built from **only the flags the user actually supplied**: add a key for each flag the user
  gave, and omit the rest. The script fills in the documented defaults for anything omitted (whole repository,
  `--effort high`, `--breadth auto`, `--depth 1`), so do not synthesise default values here, and never include
  `--output`. Examples: `/repo-review src --breadth 6` → `{ "path": "src", "breadth": 6 }`; a bare `/repo-review` with
  no arguments → `{}`.

Finalise every argument value *before* you call `Workflow`. Running that workflow *is* the review: it runs in the
background and returns a structured result when it finishes. Do not launch review subagents outside it, do not re-run it
while it is in flight, and — importantly — do not stop and restart it merely to change a default or an argument you
could have set at launch (a run already under way is not wrong just because you could have passed, or omitted, a value
explicitly). The only reason to stop a run is a genuine wedge — most agents done, a few idle for many minutes — after
which you may re-run, watching progress in `/workflows`, optionally at a lower `--effort`.

The result is `{ findings, exclusions, gaps }`:

- `findings` — validated issues. Each has `description`, `severity` (`critical`/`high`/`medium`/`low`), `category`,
  `file`, `lines` (may be empty), `otherSites` (other affected file:line or modules, may be empty), and `reason`.
- `exclusions` — `{ path, reason }` entries for everything the partitioner left out (vendored/third-party code,
  generated code, lock files, binaries).
- `gaps` — strings naming any reviewer, lens, or validation that did not complete.

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

If `--output <file>` was provided, write the same report to that file.

Do not create GitHub issues, do not post comments, and do not commit anything. This command reports; it does not act.

## Notes

- The script enforces what this command depends on, so you do not manage it here: it sets each agent's `model` tier
  (`haiku`/`sonnet`/`opus`) and its `effort`, and it caps the high-fan-out reviewers and validators at `xhigh`, clamping
  `max` down. That cap is a deliberate reliability tradeoff — those agents run at high multiplicity (roughly `--breadth`
  × 6 reviewers, plus validators per issue), and launching that many concurrent `max` Opus inferences has been observed
  to intermittently stall (an agent gets its tool result and its next turn never arrives). Because the review phase is a
  `parallel()` barrier, one hung agent can wedge the run; the cap keeps the many leaf agents off `max`, the only level
  observed to stall. A *silent* hang has no timeout to recover from — hence watching `/workflows` above.
- The script resolves failures it can see: each fan-out runs under `parallel()`, which resolves a failed agent to
  `null` rather than rejecting the batch, and every dropped reviewer, lens, or validation is recorded in `gaps`. Surface
  those gaps in the output.
- `allowed-tools` governs only this wrapper — running the workflow and formatting its result — not the subagents the
  workflow launches. Those carry their own default tool pool, so reviewers and validators can `Read`, `Grep`, `Glob`,
  and `git ls-files` the repository regardless of this list; you neither need to nor can provision their tools from
  here. This list is therefore minimal: `Workflow` to run the review, the two read-only `git` commands used to build
  permalinks, and `Write` for `--output`.
- Cite each finding with a file path and line range, and link it if the repository has a GitHub remote. Follow this
  format precisely, otherwise the Markdown preview won't render correctly:
  https://github.com/anthropics/claude-code/blob/c21d3c10bc8e898b7ac1a2d745bdc9bc4e423afe/package.json#L10-L15

  - Requires the full commit SHA; obtain it with `git rev-parse HEAD`.
  - Repo name must match the repo you're reviewing. Get the remote with `git remote get-url origin`; it may be in SSH
    form (`git@github.com:owner/repo.git`), which you must convert to `https://github.com/owner/repo`.
  - `#` sign after the file name.
  - Line range format is `L[start]-L[end]`. Single line format is `L[number]`.
- If the repository has no GitHub remote, cite findings as `path/to/file.ext:12-18` instead.
