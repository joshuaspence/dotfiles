# Trust a directory in Claude Code without its prompt, the way the docs say to trust a folder by hand:
# <https://code.claude.com/docs/en/permissions#project-allow-rules-and-workspace-trust>
#
# Inside a git repository Claude Code looks trust up at the repository root, so pass that rather than a subdirectory.
#
# `jq` cannot edit in place, so it writes a copy that replaces the file atomically. That bypasses the lock running
# sessions take to save, so a save landing between the read and the `mv` is lost -- hence writing only while the key is
# missing.
#
# Usage: `claude-trust-dir <dir>`
function claude-trust-dir() {
  local -r config="${CLAUDE_CONFIG_DIR:-${HOME}}/.claude.json"

  # Claude Code keys trust by its working directory, which the kernel reports with symlinks resolved.
  local dir
  dir="$(realpath -- "${1:?Usage: claude-trust-dir <dir>}")" || return

  if ! jq --exit-status --arg dir "${dir}" '.projects[$dir].hasTrustDialogAccepted' "${config}" >/dev/null; then
    local tmp
    tmp="$(mktemp "${config}.XXXXXX")" || return
    if ! jq --arg dir "${dir}" '.projects[$dir].hasTrustDialogAccepted = true' "${config}" >"${tmp}" ||
      ! mv -- "${tmp}" "${config}"; then
      rm --force -- "${tmp}"
      return 1
    fi
  fi
}

# Launch Claude Code in a fresh scratch working directory.
#
# Use it for throwaway tasks you don't want cluttering (or reading from) a real project. Each session gets its own
# directory under `${XDG_RUNTIME_DIR}/claude-scratch`, on a `tmpfs` that is emptied when the last login session ends.
#
# Not under `/tmp`: Claude Code loads `CLAUDE.md`, `CLAUDE.local.md` and `AGENTS.md` from every directory above its
# working directory, and any account can plant one in a world-writable parent. Only this user can write to
# `$XDG_RUNTIME_DIR`, and its parents belong to root.
#
# The transcript lands in the real `$CLAUDE_CONFIG_DIR`, keyed by the working directory. That is unique to each session,
# so `--continue` never finds an earlier one.
function claude-scratch() {
  local -r scratch_dir="${XDG_RUNTIME_DIR:-/run/user/$(id --user)}/claude-scratch"
  mkdir --parents "${scratch_dir}" || return

  # Claude Code takes folder trust from the nearest trusted ancestor outside a git repository, so trusting the shared
  # parent covers every session. Accepting the prompt inside a session would trust only that session's directory.
  claude-trust-dir "${scratch_dir}" || return

  local work_dir
  work_dir="$(mktemp --directory --tmpdir="${scratch_dir}")" || return
  env --chdir "${work_dir}" claude "$@"
}
