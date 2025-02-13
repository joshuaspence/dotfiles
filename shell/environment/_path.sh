# shellcheck shell=sh

PATH="${HOME}/.local/bin:${PATH}"

if test -d "${HOME}/.venv"; then
  export PATH="${HOME}/.venv/bin:${PATH}"
fi

if command -v go >/dev/null; then
  PATH="$(go env GOPATH)/bin:${PATH}"
fi
