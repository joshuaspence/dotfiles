# Global instructions

> [!NOTE]
> The repository's own style guide wins — an `.editorconfig`, a formatter config, a documented convention or simply the
> way the surrounding files and commits read. Check for one first; what follows is the default in its absence.

## Code

- **All code is a liability.** Every line is somewhere a bug can live, so less code usually means fewer bugs. Weigh the
  code a change costs against the value it delivers, and remember the cheapest code to maintain is the code not written.
  But lines are a proxy, not the liability itself: the simplest code is not the smallest, and decomposing an expression
  or lengthening a name to say what it means is worth the size it costs.
- **Fail loudly rather than quietly.** The most expensive bugs are silences, not errors, and a silence is an assumption
  that went unverified, so prefer an error to a fallback that carries on without the thing it was meant to do. Where you
  own the interface, make the failure path the default: an API the caller cannot use wrongly beats one they must
  remember to check.
- **A missing prerequisite fails; only an inapplicable test is skipped.** A skip reads exactly like a pass, so a fixture
  that skips what it cannot reach hides the half of the suite that never ran. Deselect what does not apply so it is
  never counted, and read the skip count before believing a suite that passed easily.
- **Reach for a library or a built-in before reimplementing a solved problem.** A repository's own internal libraries
  count the same as a dependency. Behaviour is the gate: a package earns its place only if it can be driven to fail
  loudly rather than guess, and that outranks any amount of code it would delete. Adoption, testing and recent activity
  then weigh the cost of owning it, since an unmaintained dependency is code you did not write but still own.
- **Derive a value rather than transcribing it.** An ID, port or path is read from wherever it is authoritative, not
  copied into a second place. A copy earns its place only where deriving it cannot work or would be too slow, and then
  only if something fails when it and the source disagree.
- **Expose only the flags, options and settings strictly needed.** Adding an option later is backwards compatible but
  removing one is not, so a knob is cheap to add when something finally needs it and expensive to take away once callers
  depend on it — hold it back until then.
- **Simplify aggressively.** Prefer the shorter form when it says the same thing, consolidate duplicates rather than
  letting parallel copies drift, and drop compatibility nothing depends on yet. A change that adds words without adding
  meaning is not an improvement.

## Comments and prose

- **Assume Markdown unless there is reason not to, even in code comments.** Fence code blocks with triple backticks,
  mark italics with `*` and bold with `**`, and write links as `[name](url)`.
- **Surround code references and paths with backticks.** The exception is referring to something by name rather than
  as a literal: Bash the shell, but `bash` the command.
- **Wrap code, comments and prose at 120 columns, filled.** Reflow with the formatter where one exists rather than by
  hand. Markdown tables are exempt.
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
- **Headings and titles take sentence case.**

## Git

- **One logical change per commit.** Stage the paths you touched rather than the whole tree, and split a branch that has
  grown past one idea.
- **Commit without asking; never push or merge without being asked.** Committing finishes the work, pushing leaves the
  machine, and merging is the user's own action: get a pull request green and approved once asked to open one, report
  that and stop. Enabling auto-merge counts as merging even though it isn't one, so ask first.
- **Expect the user to amend your commits.** A commit that has changed since you made it is the user's own edit, not a
  fault to investigate or undo. Read the amendment, though: it is the clearest evidence of a convention this file has
  not yet stated, so codify it rather than absorbing it quietly.
- **Imperative subject, prose body wrapped at 72.** Sentence case, no conventional-commit prefix, no trailing full stop,
  backticks around identifiers. The body explains why; the diff already says what.
- **Match the repository's landing convention.** Check whether it takes commits on the default branch or a branch and a
  pull request rather than assuming either.

### Ask once per session before working in a worktree

At the first change-making work of a session in a git repository, ask whether to work in a git worktree and honour that
answer for the rest of the session: `EnterWorktree` on a yes, `ExitWorktree` when the work is done. Isolation earns its
cost when several agents run at once or the main checkout has work in progress, and not otherwise, so it is the user's
call.

- **Ask at the first edit, not at session start**, so a read-only session never raises it, and ask **once** — the answer
  carries across the rest of the session, including other repositories, and holds even where a later checkout would tip
  the balance the other way, because re-asking each repository costs more than living with the first answer.
- **Do not ask when there is nothing to decide**: already answered, not a git repository or already inside a linked
  worktree.
- **Recommend against one when it would be wrong, and say why.** A fresh worktree branches from the remote default
  branch, so it arrives without unpushed local work — check before offering.

### Tear down worktrees once their branch has merged

When wrapping up, remove the worktree this session used and delete its branch once merged, then report what was removed.
Sweep other pre-existing worktrees only when asked.

- **Remove the worktree before deleting its branch**, and delete only with `git branch -d`: a refusal means the branch
  is not merged, so leave it and say so.
- **Never force past real work or an owner.** `ExitWorktree` may refuse a worktree it does not own — fall back to
  `action: "keep"` and remove it from the main checkout. A worktree with initialised submodules refuses removal without
  `--force` however clean it is, so reserve `--force` for regenerable content and inspect before reaching for it.
- **Verify the end state** with `git worktree list` and `git branch` rather than assuming it.

## Working together

- **Change only what was asked.** An unrequested change costs more to review than it saves, so say what else needs
  fixing and let it be its own change.
- **Prefer ground truth to reasoning about it.** Query the environment, read the capture, run the command. A claim you
  have not checked is a guess however confident it sounds, so check it or say that you have not.
- **Never commit anything that authenticates.** The test is capability, not identifiability. Keep secrets out of argv
  and off disk, and enumerable specifics in a gitignored local config.
- **Codify what was learned.** Prefer a check that fails: a test, a lint rule or a gate holds a convention in a way
  prose cannot. Where none fits, write it into the repository's `CLAUDE.md`, `DESIGN.md` or memory as part of the same
  change; a stale reference document is how a repository misleads the next reader.
