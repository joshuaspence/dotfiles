# shellcheck shell=sh

PATH="${HOME}/.local/bin:${PATH}"

# Go's default `GOPATH` rather than `go env GOPATH`: `go` comes from mise, which is not active yet here and never is in
# a non-interactive shell, and running it through a stale shim can make mise download Go during login.
PATH="${HOME}/go/bin:${PATH}"
