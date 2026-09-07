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
