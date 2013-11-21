#/
## Environment variables for {@link http://golang.org/ Go}.
##
## @author Joshua Spence
## @file   ~/.shell/environment/golang.sh
#\

command -v go &>/dev/null && {
    export GOPATH="${HOME}/go"
}
