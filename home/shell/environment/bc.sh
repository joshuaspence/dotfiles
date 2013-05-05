#/
## Environment variables for `bc`.
##
## @author Joshua Spence
## @file   ~/.shell/environment/bc.sh
#\

command -v bc &>/dev/null && {
    if [[ -f ${HOME}/.bcrc && -r ${HOME}/.bcrc ]]; then
        export BC_ENV_ARGS+="-lq ${HOME}/.bcrc"
    else
        export BC_ENV_ARGS='-lq'
    fi
}
