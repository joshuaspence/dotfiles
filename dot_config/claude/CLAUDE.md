# Global instructions

## Always make changes in a git worktree

Before modifying files in a git repository, move this session into a git worktree first by calling the `EnterWorktree`
tool. Do this **by default** for any change-making work, so edits, commits, and any resulting branch stay isolated from
the main checkout. Call `ExitWorktree` when the work is done.

Skip the worktree and work in place only when:

- The user explicitly says not to (e.g. "don't use a worktree", "just edit here", "work on the current branch").
- The task is read-only (answering questions, reviewing, searching, running tests without editing).
- The directory is not a git repository, or the session is already inside a linked worktree (`git rev-parse --git-dir`
  differs from `--git-common-dir`).

## Tear down worktrees once their branch has merged

The teardown half of the default above: when wrapping up, if a worktree's branch has been merged (its PR is merged, or
`git log <base>..<branch>` is empty), remove the worktree and delete the branch, then report what was removed. Close
the lifecycle you opened rather than leaving merged worktrees and branches to accumulate.

- **Scope:** Proactively tear down the worktree this session created or worked in. Sweep _other_ pre-existing worktrees
  only when the user asks (e.g. "clean up worktrees").
- **Confirm before deleting:** Delete a branch only once it is merged, and only with `git branch -d` (never `-D`): the
  safe form refuses an unmerged branch, so a refusal means it is not merged — leave it and say so.
- **Order:** Remove the worktree before deleting its branch — git will not delete a branch that is checked out in any
  worktree (shown with a `+` in `git branch`).
- **`ExitWorktree` may refuse to remove** a worktree it does not own — a resumed session, or one another live session
  holds the liveness lock on. Fall back to `ExitWorktree` with `action: "keep"` to return to the main checkout, then
  run `git worktree remove` from there.
- **`git worktree remove` refuses worktrees with initialized submodules** unless given `--force`, independent of
  whether the tree is dirty. `--force` is safe when the branch is merged and the only content is regenerable (e.g.
  vendored test-framework submodules); never `--force` past real uncommitted work — inspect first. **Never remove a
  locked or in-use worktree.** If `git worktree remove` refuses and names an owner, leave it.

Verify the end state with `git worktree list` and `git branch`, and report what was removed rather than assuming.
