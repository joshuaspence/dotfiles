---
allowed-tools: Bash(git:*), Bash(rg:*), Bash(find:*), Bash(wc:*), Bash(ls:*), Bash(echo:*), Glob, Grep, Read
description: Code review an entire repository
argument-hint: "[path] [--output <file>] [--focus <area>]"
---

Provide a code review for an entire repository.

Arguments: $ARGUMENTS

- An optional path scopes the review to a subtree. If absent, review the whole repository.
- `--output <file>` writes the report to that file in addition to the terminal.
- `--focus <area>` biases the reviewers toward one concern (e.g. `security`, `correctness`, `claude-md`).

Repository context:

- Root: !`git rev-parse --show-toplevel 2>/dev/null || echo "(not a git repository)"`
- HEAD: !`git log -1 --format=%H 2>/dev/null || echo "(no commits)"`
- Remote: !`git remote get-url origin 2>/dev/null || echo "(no remote)"`
- Tracked files: !`git ls-files 2>/dev/null | wc -l`

**Agent assumptions (applies to all agents and subagents):**
- All tools are functional and will work without error. Do not test tools or make exploratory calls. Make sure this is clear to every subagent that is launched.
- Only call a tool if it is required to complete the task. Every tool call should have a clear purpose.

To do this, follow these steps precisely:

1. Launch a haiku agent to survey the repository and return: the primary languages, the build/test tooling, the entry points, and the top-level directory structure with a file count per directory. Tell it to use `git ls-files` rather than walking the filesystem, so that ignored files are excluded automatically.

2. Launch a haiku agent to return a list of file paths (not their contents) for all CLAUDE.md files in the repository.

3. Launch a sonnet agent to partition the repository into 4-8 coherent review units, using the survey from step 1. Each unit should be a module, package, or directory group that can be understood on its own. The agent must return, alongside the units, an explicit list of everything it excluded and why.

   Exclude from review: vendored and third-party directories, generated code, lockfiles, minified assets, binary files, and build output.

   **Report the exclusions in your final output.** A repository review that silently skipped half the tree reads as "the whole repo is clean" when it is not.

4. For each review unit from step 3, launch agents in parallel to independently review it. Each agent should return a list of issues, where each issue includes a description, the file and line, and the reason it was flagged (e.g. "CLAUDE.md adherence", "bug"). The agents should do the following:

   Agent 1: CLAUDE.md compliance sonnet agent
   Audit the unit for CLAUDE.md compliance. Note: When evaluating CLAUDE.md compliance for a file, you should only consider CLAUDE.md files that share a file path with the file or parents.

   Agent 2: Opus bug agent (parallel subagent with agents 3 and 4)
   Scan for correctness bugs within the unit: incorrect logic, unhandled error paths, broken invariants, resource leaks, concurrency mistakes.

   Agent 3: Opus security agent (parallel subagent with agents 2 and 4)
   Look for security problems in the unit: injection, unsafe deserialization, path traversal, missing authorization checks, secrets committed to the repository.

   Agent 4: Sonnet consistency agent (parallel subagent with agents 2 and 3)
   Look for problems only visible with the whole repository in view: callers that disagree with a function's current contract, duplicated logic that has diverged, dead code that is still exported, and configuration that contradicts the code that reads it. Cross-reference against the other units, not just this one.

   **CRITICAL: We only want HIGH SIGNAL issues.** Flag issues where:
   - The code will fail to compile or parse (syntax errors, type errors, missing imports, unresolved references)
   - The code will definitely produce wrong results regardless of inputs (clear logic errors)
   - A caller and a callee genuinely disagree, and you have read both
   - Clear, unambiguous CLAUDE.md violations where you can quote the exact rule being broken

   Do NOT flag:
   - Code style or quality concerns
   - Potential issues that depend on specific inputs or state
   - Subjective suggestions or improvements
   - Architectural rewrites, or "this would be better as X"

   If you are not certain an issue is real, do not flag it. False positives erode trust and waste reviewer time.

   In addition to the above, each subagent should be told the survey from step 1. This will help provide context regarding the repository's purpose and conventions.

5. For each issue found in the previous step, launch parallel subagents to validate the issue. These subagents should get the repository survey along with a description of the issue. The agent's job is to review the issue to validate that the stated issue is truly an issue with high confidence. For example, if an issue such as "variable is not defined" was flagged, the subagent's job would be to validate that is actually true in the code. Another example would be CLAUDE.md issues. The agent should validate that the CLAUDE.md rule that was violated is scoped for this file and is actually violated. Use Opus subagents for bugs, security, and consistency issues, and sonnet agents for CLAUDE.md violations.

   Validators must open the actual file rather than trusting the reporting agent's excerpt.

6. Filter out any issues that were not validated in step 5. This step will give us our list of high signal issues for our review.

7. Deduplicate. The same defect will often be reported by several units, and a single root cause may surface at many call sites. Merge those into one issue with a primary location and a list of the other affected sites.

8. Output a summary of the review findings to the terminal, ordered most severe first:
   - If issues were found, list each issue with a brief description, its file and line, and why it was flagged.
   - If no issues were found, state: "No issues found. Checked for bugs, security, consistency, and CLAUDE.md compliance."
   - In both cases, state which parts of the repository were excluded in step 3.
   - If more than 20 issues survive validation, report the 20 most severe and state plainly how many were withheld.

   If `--output <file>` was provided, write the same report to that file.

   Do not create GitHub issues, do not post comments, and do not commit anything. This command reports; it does not act.

Use this list when evaluating issues in Steps 4 and 5 (these are false positives, do NOT flag):

- Something that appears to be a bug but is actually correct
- Pedantic nitpicks that a senior engineer would not flag
- Issues that a linter will catch (do not run the linter to verify)
- General code quality concerns (e.g., lack of test coverage, general security issues) unless explicitly required in CLAUDE.md
- Issues mentioned in CLAUDE.md but explicitly silenced in the code (e.g., via a lint ignore comment)
- Deliberate, documented deviations, where a comment explains why the code is the way it is

Note that "pre-existing issue" is NOT a false positive here. Every issue in a repository review is pre-existing; that is the point of reviewing a repository rather than a diff. Judge each issue on whether it is real and significant today, not on when it was introduced.

Notes:

- Do not check build signal, and do not attempt to build, typecheck, lint, or test the repository. Review the source as written.
- Create a todo list before starting.
- You must cite each issue with a file path and line range, and link it if the repository has a GitHub remote.
- Prefer `git ls-files` and `rg` over `find` when enumerating or searching, so that ignored files stay out of the review.
- When linking to code, follow the following format precisely, otherwise the Markdown preview won't render correctly: https://github.com/anthropics/claude-code/blob/c21d3c10bc8e898b7ac1a2d745bdc9bc4e423afe/package.json#L10-L15
  - Requires full git sha
  - Use the HEAD sha injected in the repository context above, rather than shelling out for it
  - Repo name must match the repo you're reviewing. The injected remote may be in
    SSH form (`git@github.com:owner/repo.git`); convert it to `https://github.com/owner/repo`
  - # sign after the file name
  - Line range format is L[start]-L[end]
  - Provide at least 1 line of context before and after, centered on the line you are commenting about (eg. if you are commenting about lines 5-6, you should link to `L4-7`)
- If the repository has no GitHub remote, cite issues as `path/to/file.ext:12-18` instead.
