# shellcheck shell=sh

PATH="${HOME}/.local/bin:${PATH}"

if test -d "${HOME}/.venv"; then
  export PATH="${HOME}/.venv/bin:${PATH}"
fi

if command_exists go; then
  PATH="$(go env GOPATH)/bin:${PATH}"
fi
