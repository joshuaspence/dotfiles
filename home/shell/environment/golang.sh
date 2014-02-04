#/
## Environment variables for {@link http://golang.org/ Go}.
#\

command -v go &>/dev/null && {
    export GOPATH="${HOME}/.go"
    export PATH="$PATH:$GOPATH/bin"
}
