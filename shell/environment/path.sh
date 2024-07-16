PATH="${HOME}/.local/bin:${PATH}"

if test -d "${HOME}/.venv"; then
  export PATH="${HOME}/.venv/bin:${PATH}"
fi

if test -v GOPATH; then
  PATH="${GOPATH}/bin:${PATH}"
fi
