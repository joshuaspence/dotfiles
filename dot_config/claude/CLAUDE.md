# Global Instructions

> [!NOTE]
> The repository's own style guide wins — an `.editorconfig`, a formatter config, a documented convention or simply the
> way the surrounding files and commits read. Check for one first; what follows is the default in its absence.

## Code

- **All code is a liability.** Every line is somewhere a bug can live, so less code usually means fewer bugs. Weigh the
  code a change costs against the value it delivers, and remember the cheapest code to maintain is the code not written.
  But lines are a proxy, not the liability itself: the simplest code is not the smallest, and decomposing an expression
  or lengthening a name to say what it means is worth the size it costs.
- **Reach for a library or a built-in before reimplementing a solved problem.** A repository's own internal libraries
  count the same as a dependency, and its adoption, testing and recent activity weigh the cost of owning it, since an
  unmaintained dependency is code you did not write but still own.
- **Derive a value rather than transcribing it.** An ID, port or path is read from wherever it is authoritative, not
  copied into a second place. A copy earns its place only where deriving it cannot work or would be too slow, and then
  only if something fails when it and the source disagree.
- **Expose only the flags, options and settings strictly needed.** Adding an option later is backwards compatible but
  removing one is not, so a knob is cheap to add when something finally needs it and expensive to take away once callers
  depend on it — hold it back until then.
- **Simplify aggressively.** Prefer the shorter form when it says the same thing, consolidate duplicates rather than
  letting parallel copies drift, and drop compatibility nothing depends on yet. A change that adds words without adding
  meaning is not an improvement.

## Testing

- **A missing prerequisite fails; only an inapplicable test is skipped.** A skip reads exactly like a pass, so a fixture
  that skips what it cannot reach hides the half of the suite that never ran. Deselect what does not apply so it is
  never counted, and read the skip count before believing a suite that passed easily.
- **A test shows the presence of bugs, never their absence.** A green suite means the cases you thought to write passed,
  not that the code is correct, so read coverage as a record of what was checked rather than proof that it works, and
  weigh a test by the bug it would have caught rather than the lines it touches.
- **The most valuable test drives the real thing through its real interface.** A unit test pins one function's contract,
  but an end-to-end test — running the actual command or entry point with only the mocking a hermetic run demands —
  catches the bugs that live between the units, in the wiring and the assumptions no single unit owns. Cover the units,
  but reach for the highest level that still runs fast and deterministic.

## Comments and prose

- **Assume Markdown unless there is reason not to, even in code comments.** Fence code blocks with triple backticks,
  mark italics with `*` and bold with `**`, and write links as `[name](url)`.
- **Surround code references and paths with backticks.** The exception is referring to something by name rather than as
  a literal: Bash the shell, but `bash` the command.
- **Wrap code, comments and prose at 120 characters, filled** — filled so no line carries to the next a word that would
  fit on it; characters, not bytes, so an em-dash counts as one column, not three. Reflow with the formatter where one
  exists rather than by hand; Markdown tables are exempt.
- **A comment earns its place or goes.** Comments explain why, not what, and a stale one is a defect. Delete dead code
  rather than commenting it out — the history already has it, and a commented-out block is a comment that explains
  nothing.
- **Leave the story of a change to its commit message.** A comment explaining what the code used to be, or why it
  replaced an earlier version, belongs in the commit that made the change: the present reader rarely needs that history,
  and the one who does is better served by `git log`. Comment why the code is as it is, not how it came to be.
- **Separate a commented block from the code around it with blank lines.** A comment binds to the code directly below
  it, so keep them together and set the group off with a blank line on either side; packed against unrelated lines,
  nothing marks where the comment's scope ends.
- **Quote the evidence a claim rests on.** A claim that cannot be checked cannot be falsified, so name the identifier,
  capture or commit.
- **Pad Markdown table columns to the widest cell**, write the separator row as `|-----|` and count widths in characters
  rather than bytes.
- **Link to an anchor rather than naming a heading in prose.** `[Git](#git)`, not "the Git section".
- **Skip the Oxford comma.** "foo, bar and baz", never "foo, bar, and baz".
- **A title takes title case, a heading sentence case.** A title is a document's top-level `# H1`, a heading is every
  level below it, and sentence case is the easier of the two to write consistently across the many headings a document
  carries. This reaches the `# H1` only: a commit subject keeps the sentence case [Git](#git) sets, and a PR or issue
  title is no title in this sense.

## Git

- **One logical change per commit.** Stage the paths you touched rather than the whole tree, and split a branch that has
  grown past one idea.
- **Commit without asking; never push or merge without being asked.** Committing finishes the work, pushing leaves the
  machine, and merging is the user's own action: get a pull request green and approved once asked to open one, report
  that and stop. Enabling auto-merge counts as merging even though it isn't one, so ask first.
- **Imperative subject, prose body wrapped at 72.** Sentence case, no conventional-commit prefix, no trailing full stop,
  backticks around identifiers. The body explains why; the diff already says what.
- **Match the repository's landing convention.** Check whether it takes commits on the default branch or a branch and a
  pull request rather than assuming either.

## Worktrees

- **Enter a worktree at the first edit, without asking** — `EnterWorktree` there, `ExitWorktree` once the work is done —
  and stay in one for the rest of the session, including other repositories. Isolation keeps the main checkout free for
  the user and for the agents running alongside, and is cheap enough that it is not worth a question.
- **Do not enter one where there is nothing to isolate**: not a git repository, already inside a linked worktree, or a
  session that only reads.
- **Edit in place instead, and say why, when a worktree would leave work behind.** A fresh worktree branches from the
  remote default branch, so it arrives without unpushed local commits or an uncommitted tree, and a tool that reads a
  repository from a fixed path — `chezmoi` its source directory, for one — never sees the worktree at all. Check for
  these before entering rather than after.
- **A worktree sits inside the repository, so whatever walks the filesystem sees the tree twice.** `EnterWorktree` puts
  it under `.claude/worktrees/<name>/`, and the `worktree.location` setting relocates only Claude Code Desktop's
  SSH-session worktrees — the CLI does not read it. A tool that walks instead of reading git's ignore rules, `yamllint`
  and `shfmt` among them, needs the path spelled out in its own ignore list.
- **Tear down the session's worktree once its branch has merged**, reporting what was removed; sweep other pre-existing
  worktrees only when asked.
- **Remove the worktree before deleting its branch**, and try `git branch -d` first. Its refusal is not proof the work
  is unmerged: a squash or rebase merge rewrites the commits, so the original tip stays unreachable, and `git cherry`
  misses it too since it compares patch IDs commit by commit. Confirm the content landed —
  `git cherry <base> $(git commit-tree <branch>^{tree} -p $(git merge-base <base> <branch>) -m _)` prints a leading `-`
  when it did — and only then is `git branch -D` right. Leave the branch and say so when nothing confirms it landed.
- **Never force past real work or an owner.** `ExitWorktree` may refuse a worktree it does not own — fall back to
  `action: "keep"` and remove it from the main checkout. A worktree with initialised submodules refuses removal without
  `--force` however clean it is, so reserve `--force` for regenerable content and inspect before reaching for it.
- **Verify the end state** with `git worktree list` and `git branch` rather than assuming it.

## Working together

- **Change only what was asked.** An unrequested change costs more to review than it saves, so say what else needs
  fixing and let it be its own change.
- **Prefer ground truth to reasoning about it.** Query the environment, read the capture, run the command. A claim you
  have not checked is a guess however confident it sounds, so check it or say that you have not.
- **Codify what was learned.** Prefer a check that fails: a test, a lint rule or a gate holds a convention in a way
  prose cannot. Where none fits, write it down as part of the same change: a repository-scoped lesson into that
  repository's `CLAUDE.md`, `DESIGN.md` or memory, one that holds everywhere into the global `CLAUDE.md`; a stale
  reference document is how a repository misleads the next reader.
