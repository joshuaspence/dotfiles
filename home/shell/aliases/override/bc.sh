#/
## A shell alias to override the `bc` command such that `bc` will read a startup
## file.
##
## @author Joshua Spence
## @file   ~/.shell/aliases/override/bc.sh
#\

command -v bc &>/dev/null && {
    alias bc='bc $([[ -f ${BCRC:-${HOME}/.bcrc} ]] && echo "${BCRC:-${HOME}/.bcrc}")'
}
