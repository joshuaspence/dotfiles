# shellcheck shell=sh

PATH="${HOME}/.local/bin:${PATH}"

if command -v go >/dev/null; then
  PATH="$(go env GOPATH)/bin:${PATH}"
fi
