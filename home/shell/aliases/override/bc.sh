#/
## A shell alias to override the `bc` command with an alias such that `bc` will
## read a startup file.
##
## @author Joshua Spence
## @file   ~/.shell/aliases/override/bc.sh
#\

command -v ls &>/dev/null && {
    alias bc='/usr/bin/bc $([[ -f ${BCRC:-${HOME}/.bcrc} ]] && echo "${BCRC:-${HOME}/.bcrc}")'
}
