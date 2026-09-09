# Run Claude Code inside a transient systemd user unit rooted at a disposable, self-cleaning working directory.
#
# The unit's `RuntimeDirectory` lives on the `tmpfs` at `$XDG_RUNTIME_DIR` and is reclaimed when the unit exits.
# It is bind-mounted onto a stable `/tmp/claude-scratch` inside a private mount namespace, so Claude always sees
# the same workspace path (making the folder-trust prompt a one-time thing) while each session's storage stays
# separate and disposable. Requires unprivileged user namespaces (`kernel.apparmor_restrict_unprivileged_userns=0`).
#
# Usage: `_systemd_run_claude <unit-prefix> [extra systemd-run args...] -- [claude args...]`
function _systemd_run_claude() {
  local -r unit="$1-$$-${RANDOM}"
  shift

  # Set `$CLAUDE_CONFIG_DIR` if it is unset.
  : "${CLAUDE_CONFIG_DIR:=${HOME}/.claude}"

  # Host-side location of this session's `RuntimeDirectory` (single source of truth: reused as the `BindPaths` source
  # below and surfaced to Claude via `--append-system-prompt`).
  local -r host_dir="${XDG_RUNTIME_DIR:-/run/user/$(id --user)}/${unit}"
  local -r work_dir="/tmp/claude-scratch"

  local -a systemd_run_opts=()
  systemd_run_opts+=("--unit" "${unit}")
  systemd_run_opts+=("--property" "PrivateTmp=yes")
  systemd_run_opts+=("--property" "RuntimeDirectory=${unit}")
  systemd_run_opts+=("--property" "TemporaryFileSystem=${CLAUDE_CONFIG_DIR}/projects")
  systemd_run_opts+=("--property" "WorkingDirectory=${work_dir}")
  systemd_run_opts+=("--setenv" "CLAUDE_CONFIG_DIR=${CLAUDE_CONFIG_DIR}")
  systemd_run_opts+=("--setenv" "PATH")
  systemd_run_opts+=("--setenv" "TERM")
  systemd_run_opts+=("--pty")
  systemd_run_opts+=("--quiet")
  systemd_run_opts+=("--collect")
  systemd_run_opts+=("--user")

  # Claude always sees the same workspace path, so the folder-trust prompt only fires once -- trust is keyed by cwd.
  # Each session bind-mounts its own fresh, auto-reaped `RuntimeDirectory` onto that path inside a private mount
  # namespace, so concurrent sessions stay isolated despite sharing the path. `PrivateTmp` keeps the bind mountpoint
  # off the host's `/tmp`.
  systemd_run_opts+=("--property" "BindPaths=${host_dir}:${work_dir}")

  while [[ $# -gt 0 && "$1" != "--" ]]; do
    systemd_run_opts+=("$1")
    shift
  done

  # Drop the "--" separator.
  if [[ "${1:-}" == "--" ]]; then
    shift
  fi

  # Tell Claude the workspace is disposable so it reports files honestly instead of implying they persist. The bind
  # source `${host_dir}` is a live, same-inode view of the files, reachable from the user's normal shell during the
  # session -- but it, too, is reaped when the unit exits.
  local system_prompt
  read -d '' -r system_prompt < <(sed 's/^[[:blank:]]*//' << EOT | paste --serial --delimiters=' '
    The working directory \`${work_dir}\` is a disposable scratch workspace on a \`tmpfs\`. Everything in it --
    including any files you create -- is permanently destroyed when this session exits. Do NOT tell the user that files
    were saved as if they persist; when you write files here, remind the user they are temporary and must be copied out
    before quitting. During this session the same files are also directly accessible from the user's normal shell at
    \`${host_dir}\` (that path is likewise removed on exit).
EOT
  ) || true

  systemd-run "${systemd_run_opts[@]}" claude --append-system-prompt "${system_prompt}" "$@"
}

# Launch Claude Code in a disposable, self-cleaning working directory.
#
# Use it for throwaway tasks you don't want cluttering (or reading from) a real project. Anything you want to
# keep must be copied out before you quit.
function claude-scratch() {
  _systemd_run_claude claude-scratch -- "$@"
}

# Like `claude-scratch`, but stealthier: nothing about the session is written back to the real `$CLAUDE_CONFIG_DIR`.
#
# The whole config dir is replaced with a throwaway `tmpfs`, so every write Claude makes (sessions, projects, history,
# todos, caches, ...) is discarded when the unit exits. The read-mostly bits Claude needs to actually run --
# credentials, settings, user customizations, and `.claude.json` -- are re-exposed read-only on top of the mask.
# `CLAUDE_CODE_SKIP_PROMPT_HISTORY=1` is belt-and-braces -- `history.jsonl` already lands on the discarded `tmpfs`.
#
# `.claude.json` is bound read-only so folder trust and MCP/onboarding state carry over from real runs (those are
# reads). Claude's *writes* to it fail: it saves via temp-file + rename, and you cannot rename over a bind mountpoint
# (`EBUSY`). That's the intended incognito behaviour -- those updates are throwaway state -- but it does mean any
# trust/onboarding decision made *inside* an incognito session is not remembered. Making writes succeed-but-ephemeral
# would require seeding a regular-file copy into the `tmpfs` from within the unit (an `ExecStart` wrapper;
# `systemd-run --property ExecStartPre` is silently ignored for transient units), which isn't worth the extra machinery
# here.
function claude-incognito() {
  # Match the default `_systemd_run_claude` applies, so the paths below line up with the mount it sets.
  : "${CLAUDE_CONFIG_DIR:=${HOME}/.claude}"

  local -a claude_opts=()
  claude_opts+=("--property" "TemporaryFileSystem=${CLAUDE_CONFIG_DIR}")
  claude_opts+=("--setenv" "CLAUDE_CODE_SKIP_PROMPT_HISTORY=1")

  # The plugin cache lives outside `$CLAUDE_CONFIG_DIR` now (see `CLAUDE_CODE_PLUGIN_CACHE_DIR` in `settings.json`), so
  # the mask above no longer covers it. Mask its parent and re-expose the plugins read-only, mirroring the config dir:
  # incognito writes stay throwaway while plugins keep working. Keep this path in sync with the `settings.json` value.
  local -r plugin_cache_dir="${XDG_CACHE_HOME:-${HOME}/.cache}/claude"
  claude_opts+=("--property" "TemporaryFileSystem=${plugin_cache_dir}")
  claude_opts+=("--property" "BindReadOnlyPaths=-${plugin_cache_dir}/plugins")

  # Re-expose the read-mostly config over the mask, read-only. A leading `-` on the source makes a missing path a
  # no-op instead of a unit start failure.
  local name
  for name in agents .claude.json CLAUDE.md commands .credentials.json file-suggestion.sh scripts settings.json skills statusline.sh workflows; do
    claude_opts+=("--property" "BindReadOnlyPaths=-${CLAUDE_CONFIG_DIR}/${name}")
  done

  _systemd_run_claude claude-incognito "${claude_opts[@]}" -- "$@"
}
