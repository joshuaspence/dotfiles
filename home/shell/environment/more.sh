#/
## Environment variables for `more`.
##
## @author Joshua Spence
## @file   ~/.shell/environment/more.sh
#\

command -v more &>/dev/null && {
    unset MORE
}
