#/
## Environment variables for `bc`.
##
## @author Joshua Spence
## @file   ~/.shell/environment/bc.sh
#\

command -v bc &>/dev/null && {
    ## Define the standard math library. Also, suppress the welcome screen.
    export BC_ENV_ARGS='-lq'
}
