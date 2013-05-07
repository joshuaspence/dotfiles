#/
## Environment variables for `bc`.
##
## @author Joshua Spence
## @file   ~/.shell/environment/bc.sh
#\

command -v bc &>/dev/null && {
    BCRC="${HOME}/.bcrc"
    if [[ -f $BCRC && -r $BCRC ]]; then
        export BC_ENV_ARGS="-lq ${BCRC}"
    else
        export BC_ENV_ARGS='-lq'
    fi
    unset BCRC
}
