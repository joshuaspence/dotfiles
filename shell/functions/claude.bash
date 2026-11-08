# Run Claude Code inside a transient systemd user unit rooted at a disposable, self-cleaning working directory.
#
# The unit's `RuntimeDirectory` lives on the `tmpfs` at `$XDG_RUNTIME_DIR` and is reclaimed when the unit exits.
# It is bind-mounted onto a stable `$XDG_RUNTIME_DIR/claude-scratch` inside a private mount namespace, so Claude always
# sees the same workspace path (making the folder-trust prompt a one-time thing) while each session's storage stays
# separate and disposable.
#
# Usage: `_systemd_run_claude <unit-prefix> [extra systemd-run args...] -- [claude args...]`
function _systemd_run_claude() {
  local -r unit="$1-$$-${RANDOM}"
  shift

  # Set `$CLAUDE_CONFIG_DIR` if it is unset.
  : "${CLAUDE_CONFIG_DIR:=${HOME}/.claude}"

  # Host-side location of this session's `RuntimeDirectory` (single source of truth: reused as the `BindPaths` source
  # below and surfaced to Claude via `--append-system-prompt`).
  local -r runtime_dir="${XDG_RUNTIME_DIR:-/run/user/$(id --user)}"
  local -r host_dir="${runtime_dir}/${unit}"

  # Not under `/tmp`: Claude Code loads `CLAUDE.md`, `CLAUDE.local.md` and `AGENTS.md` from every directory above its
  # working directory, and any account can plant one in a world-writable parent. Only this user can write to
  # `$XDG_RUNTIME_DIR`, and its parents belong to root.
  local -r work_dir="${runtime_dir}/claude-scratch"

  local -a systemd_run_opts=()
  systemd_run_opts+=("--unit" "${unit}")
  systemd_run_opts+=("--property" "RuntimeDirectory=${unit}")
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
  # namespace, so concurrent sessions stay isolated despite sharing the path. The host sees only an empty mountpoint.
  #
  # `/tmp` is deliberately shared with the host rather than made private with `PrivateTmp`: programs find their running
  # peers through sockets there -- Chrome's `SingletonSocket`, Claude Code's own `/tmp/cc-daemon-*` -- and hiding them
  # makes a browser opened from the session start a second Chrome on the same profile.
  if [[ "$(sysctl --ignore --values kernel.apparmor_restrict_unprivileged_userns)" != "0" ]]; then
    echo "Unprivileged user namespaces are restricted, so the scratch directory cannot be bind-mounted." >&2
    return 1
  fi
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
  local -ra system_prompt_lines=(
    "The working directory \`${work_dir}\` is a disposable scratch workspace on a \`tmpfs\`. Everything in it --"
    "including any files you create -- is permanently destroyed when this session exits. Do NOT tell the user that"
    "files were saved as if they persist; when you write files here, remind the user they are temporary and must be"
    "copied out before quitting. During this session the same files are also directly accessible from the user's normal"
    "shell at \`${host_dir}\` (that path is likewise removed on exit)."
  )

  # `${array[*]}` joins its elements on the first character of `$IFS`.
  local IFS=' '
  local -r system_prompt="${system_prompt_lines[*]}"

  systemd-run "${systemd_run_opts[@]}" claude --append-system-prompt "${system_prompt}" "$@"
}

# Launch Claude Code in a disposable, self-cleaning working directory.
#
# Use it for throwaway tasks you don't want cluttering (or reading from) a real project. Anything you want to keep must
# be copied out before you quit.
#
# Only the working directory is disposable. The transcript lands in the real `$CLAUDE_CONFIG_DIR`, keyed by the stable
# `$XDG_RUNTIME_DIR/claude-scratch` path, so `--resume` and `--continue` work across sessions -- but they restore the
# conversation, not the files it talks about, which died with the unit that wrote them.
function claude-scratch() {
  _systemd_run_claude claude-scratch -- "$@"
}
