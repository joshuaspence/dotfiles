# Run Claude Code inside a transient systemd user unit rooted at a disposable, self-cleaning working directory.
#
# The unit's `RuntimeDirectory` lives on the `tmpfs` at `$XDG_RUNTIME_DIR` and is reclaimed when the unit exits.
# It is bind-mounted onto a stable `/tmp/claude-scratch` inside a private mount namespace, so Claude always sees
# the same workspace path (making the folder-trust prompt a one-time thing) while each session's storage stays
# separate and disposable. Requires unprivileged user namespaces (`kernel.apparmor_restrict_unprivileged_userns=0`).
#
# Usage: `_systemd_run_claude <unit-prefix> [extra systemd-run args...] -- [claude args...]`
function _systemd_run_claude() {
  local unit="$1-$$"
  shift

  local -a systemd_run_opts=()
  systemd_run_opts+=("--unit" "${unit}")
  systemd_run_opts+=("--property" "PrivateTmp=yes")
  systemd_run_opts+=("--property" "RuntimeDirectory=${unit}")
  systemd_run_opts+=("--property" "WorkingDirectory=/tmp/claude-scratch")
  systemd_run_opts+=("--pty")
  systemd_run_opts+=("--quiet")
  systemd_run_opts+=("--collect")
  systemd_run_opts+=("--user")

  # Claude always sees the SAME workspace path (/tmp/claude-scratch), so the folder-trust prompt only fires once --
  # trust is keyed by cwd. Each session bind-mounts its own fresh, auto-reaped RuntimeDirectory onto that path inside a
  # private mount namespace, so concurrent sessions stay isolated despite sharing the path. `PrivateTmp` keeps the bind
  # mountpoint off the host's `/tmp`.
  systemd_run_opts+=("--property" "BindPaths=${XDG_RUNTIME_DIR:-/run/user/$(id --user)}/${unit}:/tmp/claude-scratch")

  while [[ $# -gt 0 && "$1" != "--" ]]; do
    systemd_run_opts+=("$1")
    shift
  done

  # Drop the "--" separator.
  shift

  systemd-run "${systemd_run_opts[@]}" claude "$@"
}

# Launch Claude Code in a disposable, self-cleaning working directory.
#
# Use it for throwaway tasks you don't want cluttering (or reading from) a real project. Anything you want to
# keep must be copied out before you quit.
function claude-scratch() {
  _systemd_run_claude claude-scratch -- "$@"
}

# Like `claude-scratch`, but stealthier.
#
# Sets `CLAUDE_CODE_SKIP_PROMPT_HISTORY=1` so prompts aren't recorded to Claude Code's history.
function claude-incognito() {
  _systemd_run_claude claude-incognito \
    --setenv "CLAUDE_CODE_SKIP_PROMPT_HISTORY=1" \
    -- "$@"
}
