#/
## @author Joshua Spence
## @file   ~/.shell/functions/path/set.sh
#\

## Source prerequisite shell functions. #{{{
    command -v remove-path >/dev/null || source "${HOME}/.shell/functions/path/remove.sh"
## #}}}

## Sets a colon-separated search path variable, overwriting any previous values.
##
## @param [String] Path variable to manipulate (ex: PATH, PYTHONPATH, etc).
## @param [List] Space-separated list of system paths to append, in order.
##
## @link http://github.com/fnichol/bashrc/blob/master/bashrc
function set-path() {
    local path_var="$1" && shift

    # Set var and overwrite any previous values.
    [[ -d $1 ]] && eval "${path_var}=\"$1\""
    shift

    local p
    for p in $@; do
        remove-path "${path_var}" "${p}"
        [[ -d $p ]] && eval "${path_var}=\"\${${path_var}}:${p}\""
    done
}
