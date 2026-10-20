# shellcheck shell=sh

PATH="${HOME}/.local/bin:${PATH}"

# Shims put mise's tools on `PATH` for the probes that follow, which run before `~/.bashrc` activates mise, and for
# non-interactive shells, which never do. mise has no `sh` shell type, but its `bash` output for `--shims` is POSIX.
if command -v mise >/dev/null; then
  eval "$(mise activate bash --shims)"
fi

if command -v go >/dev/null; then
  PATH="$(go env GOPATH)/bin:${PATH}"
fi
