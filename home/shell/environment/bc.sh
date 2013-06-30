#/
## Environment variables for `bc`.
##
## @author Joshua Spence
## @file   ~/.shell/environment/bc.sh
#\

command -v bc &>/dev/null && {
    export BC_ENV_ARGS='-lq'
}
