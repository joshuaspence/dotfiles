#/
## A shell alias to override the `bc` command such that `bc` will read a startup
## file.
#\

command -v bc &>/dev/null && {
    alias bc='bc $([[ -f ${BCRC:-${HOME}/.bcrc} ]] && echo "${BCRC:-${HOME}/.bcrc}")'
}
