---
name: Repo Review
description: Review an entire repository
argument-hint: '[path] [--effort <low|medium|high|xhigh|max>] [--breadth <n>] [--depth <n>] [--output <file>]'
allowed-tools:
  - Bash(git ls-files:*)
  - Bash(git remote:*)
  - Bash(git rev-parse:*)
  - Glob
  - Grep
  - Read
  - Task
  - Write
---

Provide a code review for an entire repository.

The arguments to this command are: `$ARGUMENTS`. Parse them as follows:

- A bare `path` argument is an optional path which scopes the review to a subtree. If absent, review the whole
  repository.
- `--effort <low|medium|high|xhigh|max>` sets the reasoning effort each spawned subagent should use. If absent, default
  to `high`. Reject any other value and stop with an error rather than guessing.
- `--breadth <n>` sets how many coherent review units the repository is partitioned into in step 3. Must be a positive
  integer. If absent, let the partitioner choose in the range 4–8.
- `--depth <n>` sets how many independent validators run per issue in step 5. Must be a positive integer; default `1`.
  With `n > 1`, keep an issue only if a strict majority of its validators confirm it (e.g. ≥2 of 3, ≥3 of 5).

  `--breadth` and `--depth` are orthogonal to `--effort`: they scale how many agents run and how many times findings
  are challenged, whereas `--effort` scales how hard each individual agent thinks.

- `--output <file>` writes the report to that file in addition to the terminal.

Whenever you launch a subagent in the steps below — surveyors, partitioner, reviewers, and validators alike — instruct
it in its prompt to use the chosen effort level (e.g. "Use `high` reasoning effort for this task."). This does not
change which model tier each step calls for, nor how many agents run; it only scales how hard each agent thinks.

To do this, follow these steps precisely:

1. Launch a `haiku` agent to survey the repository and return: the primary languages, the build/test tooling, the entry
   points, and the top-level directory structure with a file count per directory. Instruct it to use `git ls-files`
   rather than walking the filesystem, so that ignored files are excluded automatically.

2. Launch a `haiku` agent to return a list of file paths (not their contents) for all `CLAUDE.md` files in the
   repository.

3. Launch a `sonnet` agent to partition the repository into coherent review units, using the survey from step 1.
   Partition into the number of units given by `--breadth`; if `--breadth` was not provided, let the agent choose in
   the range 4–8.
   Each unit should be a module, package, or directory group that can be understood on its own. The agent must return,
   alongside the units, an explicit list of everything it excluded and why.

   Explicitly excluded from review are vendored and third-party dependencies, generated code, lock files and binary
   files. Report the exclusions in your final output. A repository review that silently skipped half the tree reads as
   "the whole repo is clean" when it is not.

4. Review the repository, launching all of the following agents in parallel:

   - For **each** review unit from step 3, launch the per-unit reviewers (Agents 1-6 in [Subagents](#subagents)) to
     independently review that unit.
   - Over the **entire** repository, launch the Architecture agent ([Agent 7](#agent-7-architecture-agent-opus)) — **one
     instance per lens** listed under that agent, not per review unit, since each lens reasons about the repository as a
     whole.

   Each agent should return a list of issues, where each issue includes a description, the file and line (or the set of
   files and modules involved, for repository-wide findings), and the reason it was flagged (e.g. "`CLAUDE.md`
   adherence", "bug", "architecture"). Each subagent should be told the survey from step 1. This will help provide
   context regarding the repository's purpose and conventions.

   If you are not certain an issue is real, do not flag it. False positives erode trust and waste reviewer time.

5. For each issue found in the previous step, launch parallel subagents to validate the issue — run `--depth`
   independent validators per issue (default `1`), and when `--depth` is greater than 1 keep the issue only if a strict
   majority of its validators confirm it. These subagents should
   get the repository survey along with a description of the issue. The agent's job is to review the issue to validate
   that the stated issue is truly an issue with high confidence. For example, if an issue such as "variable is not
   defined" was flagged, the subagent's job would be to validate that is actually true in the code. Another example
   would be `CLAUDE.md` issues. The agent should validate that the `CLAUDE.md` rule that was violated is scoped for
   this file and is actually violated. Use `opus` subagents for bugs, security, consistency, and architecture issues,
   and `sonnet` agents for `CLAUDE.md`, code-quality, and test-critique violations.

   Validators must open the actual file — or, for repository-wide findings such as architecture issues, the relevant
   files and structure — rather than trusting the reporting agent's excerpt.

6. Filter out any issues that were not validated in step 5. This step will give us our list of high signal issues for
   our review.

7. Deduplicate. The same defect will often be reported by several units, and a single root cause may surface at many
   call sites. Merge those into one issue with a primary location and a list of the other affected sites.

8. Output a summary of the review findings to the terminal, ordered most severe first:

   - If issues were found, list each issue with a brief description, its file and line, and why it was flagged.
   - If no issues were found, state: "No issues found. Checked for bugs, security, consistency, code quality,
     architecture, and `CLAUDE.md` compliance."
   - In both cases, state which parts of the repository were excluded in step 3.

   If `--output <file>` was provided, write the same report to that file.

   Do not create GitHub issues, do not post comments, and do not commit anything. This command reports; it does not act.

## Subagents

### Agent 1: `CLAUDE.md` compliance agent (Sonnet)

Audit the unit for `CLAUDE.md` compliance.

> [!NOTE]
> When evaluating `CLAUDE.md` compliance for a file, you should only consider `CLAUDE.md` files that share a file path
> with the file or parents.

### Agent 2: Bug agent (Opus)

Scan for correctness bugs within the unit: incorrect logic, unhandled error paths, broken invariants, resource leaks,
concurrency mistakes.

### Agent 3: Security agent (Opus)

Look for security problems in the unit: injection, unsafe deserialization, path traversal, missing authorization checks,
secrets committed to the repository. Where a dependency or known-vulnerable pattern is involved, cross-check against
upstream security advisories before flagging.

### Agent 4: Consistency agent (Sonnet)

Look for problems only visible with the whole repository in view: callers that disagree with a function's current
contract, duplicated logic that has diverged, dead code that is still exported, and configuration that contradicts the
code that reads it. Cross-reference against the other units, not just this one.

### Agent 5: Code quality agent (Sonnet)

Flag maintainability problems within the unit that a senior engineer would call out in review:

- Hand-written functions or modules that reimplement functionality a mature, widely-used open-source package already
  provides. Name the package you would import instead, and only flag where adopting it is a clear win — not for trivial
  one-liners where a dependency would be overkill.
- Verbose, redundant, or stale comments: comments that merely restate what the code plainly does, commented-out code
  left in place, and comments that no longer match the code they describe.
- Needless complexity where a simpler, idiomatic construct in the same language would achieve the same result.
- Gaps in test coverage: non-trivial logic, branches, or error paths that no test exercises, in a unit that otherwise
  ships tests. Name the specific behaviour that should be covered. Do not flag missing tests for trivial glue code, and
  do not flag a repository (or unit) that has no test suite at all — that is a project decision, not a review finding.

Do not flag stylistic preferences a linter or formatter would handle, and do not propose adding a dependency where the
hand-written code is small and self-contained.

### Agent 6: Test critique agent (Sonnet)

Critique the quality and effectiveness of the tests that already exist in the unit — whether they would actually catch a
regression. This is distinct from Agent 5's coverage gaps: that agent flags behaviour no test exercises; this agent
judges the tests that are present.

- Vacuous or weak assertions: tests that would still pass if the code under test were broken — asserting only that a
  call did not throw, asserting against a mocked return value rather than the behaviour under test, or snapshot/golden
  tests that assert nothing meaningful.
- Tests coupled to implementation details rather than observable behaviour, so they break under harmless refactors yet
  miss real regressions.
- Over-mocking: so much of the system under test is stubbed that the test exercises the test doubles rather than the
  real code path.
- Non-determinism: reliance on wall-clock time, `sleep`, network access, iteration/order assumptions, or state leaked
  between tests — anything that makes the test flaky or order-dependent.
- Tests whose name or description contradicts what they actually assert, and tests that assert the wrong thing.

Do not flag the mere absence of tests (that is Agent 5's remit), do not flag a unit or repository that ships no tests at
all, and do not flag stylistic test preferences a linter or formatter would handle.

### Agent 7: Architecture agent (Opus)

> [!NOTE]
> Unlike the other agents, this agent runs over the **entire repository**, not per review unit. Launch **one instance
> per lens below** (three instances), each restricted to its own lens and blind to the others.

Assess the repository's overall structure and design coherence rather than individual files. Each instance takes exactly
one of the following lenses:

- **Dependency structure** — circular dependencies between packages, import direction that violates the intended flow,
  and coupling hotspots where one module is entangled with many others.
- **Layering and boundaries** — modules reaching across architectural layers or package boundaries they should not, and
  internal details that leak across those boundaries.
- **Cohesion and duplication** — subsystems with overlapping or duplicated responsibilities, and organization that
  contradicts the conventions documented in the survey or `CLAUDE.md`.

Regardless of lens, flag only concrete, demonstrable structural defects, and cite the specific modules or files
involved. Do not flag subjective preferences or "this would be cleaner as X" rewrites.

## Evaluating issues
Use this list when evaluating issues in Steps 4 and 5 (these are false positives, do NOT flag):

- Something that appears to be a bug but is actually correct.
- Pedantic nitpicks that a senior engineer would not flag.
- Issues that a linter will catch (do not run the linter to verify).
- Issues mentioned in `CLAUDE.md` but explicitly silenced in the code (e.g., via a lint ignore comment).
- Deliberate, documented deviations, where a comment explains why the code is the way it is.

Note that "pre-existing issue" is NOT a false positive here. Every issue in a repository review is pre-existing; that is
the point of reviewing a repository rather than a diff. Judge each issue on whether it is real and significant today,
not on when it was introduced.

## Notes

- Do not check build signal, and do not attempt to build, typecheck, lint, or test the repository. Review the source as
  written.
- Reviewers and validators may consult authoritative upstream documentation (official docs, release notes, security
  advisories) to confirm how an external API, library, or framework behaves before flagging or validating an issue. This
  is the one exception to "review the source as written"; it does not license building, running, or testing the
  repository. A finding must still cite a location in this repository, not merely a discrepancy with the docs.
- Create a todo list before starting.
- You must cite each issue with a file path and line range, and link it if the repository has a GitHub remote.
- Prefer `git ls-files` over `find` when enumerating or searching, so that ignored files stay out of the review.
- When linking to code, follow the following format precisely, otherwise the Markdown preview won't render correctly: 
  https://github.com/anthropics/claude-code/blob/c21d3c10bc8e898b7ac1a2d745bdc9bc4e423afe/package.json#L10-L15

  - Requires the full commit SHA; obtain it with `git rev-parse HEAD`
  - Repo name must match the repo you're reviewing. Get the remote with `git remote get-url origin`; it may be in SSH
    form (`git@github.com:owner/repo.git`), which you must convert to `https://github.com/owner/repo`
  - `#` sign after the file name
  - Line range format is `L[start]-L[end]`. Single line format is `L[number]`
- If the repository has no GitHub remote, cite issues as `path/to/file.ext:12-18` instead.
