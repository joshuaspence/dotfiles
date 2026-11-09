---
name: claude-settings-review
description: Review Claude Code's changelog and docs for settings and features to adopt, and lint the current config
disable-model-invocation: true
---

Review this machine's Claude Code configuration against the public documentation: fix what is broken, then offer what
is new. Every recommendation is a **candidate** the user accepts or declines; nothing changes without an accept.

## Sources

Fetch with `curl` into a fresh scratch directory, never `WebFetch`: it summarises through a model and can paraphrase a
key name, and every name this review recommends must be quoted exactly as documented.

- **Changelog**: `https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md`, sliced with
  `node ~/.config/claude/scripts/claude-changelog-slice.js <changelog> <from> [<to>]`, which prints the releases after
  `from` up to and including `to` (every newer release when `to` is omitted).
- **Docs**: `https://code.claude.com/docs/llms.txt` indexes every page; each is served as Markdown at its `.md` URL.
  The catalogue of keys is `settings-reference.md`, `env-vars.md`, `permissions.md`, `sandboxing.md` and `hooks.md`.
- **Page list**: the docs' table of contents, which catches pages the changelog never mentions. Derive it with
  `grep -oE '^- \[[^]]+\]\([^)]+\)' llms.txt | sort -u` and compare it with `pages.txt`, the list as of the last
  review; a page that is new or retitled is reviewed for adoption like a changelog entry.

## Config layout

`~/.config/claude/settings.json` is rendered by chezmoi; edit only the source under `$(chezmoi source-path)`:

- `dot_config/claude/settings.json.tmpl`: keys shared by every machine
- `dot_config/claude/settings.personal.json` and `settings.work.json`: the per-profile overlay the template merges in
- `dot_config/claude/exact_skills/claude-settings-review/state.md`: this review's **state** — the last-reviewed
  version and every declined or deferred candidate with its reason
- `dot_config/claude/exact_skills/claude-settings-review/pages.txt`: the page list as of the last review

Keys the docs mark as global config live in `$CLAUDE_CONFIG_DIR/.claude.json`, which Claude Code itself writes; change
those through `/config` or `claude config`, not chezmoi. Keys the docs mark **Managed**-only are out of scope unless a
managed settings file exists on this machine.

## Steps

1. **Bound the range.** Read the installed version from `claude --version` (the first word), and the last-reviewed
   version from the state. Done when both are known, or the state has none, which makes this a **first run**.

2. **Gather candidates in a subagent**, so the changelog never enters this context. Brief it with [Sources](#sources),
   the range, the state's declined and deferred lists and the rendered `settings.json`, and have it return:
   - **Hygiene**: keys set in the rendered config that sit in the wrong file, are no longer documented or now repeat
     their documented default — checked against the whole docs catalogue every run.
   - **Adoption**: every changelog entry in the range that adds or changes a setting, env var, hook event, skill or
     plugin capability, CLI flag or slash command, with its docs URL, and every new or retitled page in the page
     list. A first run sweeps the whole docs catalogue instead, against what the config already sets.
   - **Preview**: the same, for releases after the installed version.

   Each candidate carries its exact name, what it does, the evidence (changelog line or docs URL and heading) and why it
   fits or does not fit this config. Drop a declined candidate unless its docs or changelog entry changed since it was
   declined. Done when every entry in the range and every page-list change is classified as a candidate or as
   irrelevant to configuration.

3. **Present hygiene, then adoption, then preview.** Group candidates so related ones are decided together, and give a
   recommendation for each. Done when every hygiene and adoption candidate has a decision: accept, decline or defer.
   Preview candidates are information only.

4. **Apply each accept.**
   - A **setting**: propose its target file from [Config layout](#config-layout) with a reason and wait for the user to
     confirm it, edit it, check the render with `chezmoi diff ~/.config/claude/settings.json`, `chezmoi apply` that
     path and commit the source file alone.
   - A **feature**: propose what to build and where, then build it now or defer it, as the user chooses.

   Done when every accepted candidate is committed or recorded as deferred.

5. **Record the state.** Set the last-reviewed version to the installed one, record every declined and deferred
   candidate with its reason and the date, overwrite `pages.txt` with the current page list and commit the two
   together. Done when `git status` shows nothing of this review's left uncommitted.

Commit on the source repository's current branch, one commit per change, and leave pushing to the user.
