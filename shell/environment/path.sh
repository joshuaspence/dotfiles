# shellcheck shell=sh

PATH="${HOME}/.local/bin:${PATH}"

if test -d "${HOME}/.venv"; then
  export PATH="${HOME}/.venv/bin:${PATH}"
fi

if command -v go >/dev/null; then
  PATH="$(go env GOPATH)/bin:${PATH}"
fi

if test -d /opt/mssql-tools18; then
  PATH="${PATH}:/opt/mssql-tools18/bin"
fi
