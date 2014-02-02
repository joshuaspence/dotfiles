#/
## A shell function to overwrite a search path variable.
#\

## Sets a colon-separated search path variable, overwriting any previous values.
##
## @param [String] Search path variable to manipulate (e.g. "PATH").
## @param [List]   Space-separated list of paths to append, in order.
##
## @link https://github.com/fnichol/bashrc/blob/master/bashrc
function set-path() {
    if [[ $# < 1 || -z $1 ]]; then
        echo 'Usage: set-path [-f|--force] <path_var> <path1> ... <pathN>' >&2
        return 1
    fi

    local force; if [[ $1 == '-f' || $1 == '--force' ]]; then
        force=1; shift
    else
        force=0
    fi

    local path_var="$1"; shift

    [[ -d $1 || $force == 1 ]] && eval "${path_var}=\"$1\""; shift

    local p; for p in "$@"; do
        remove-path "${path_var}" "${p}"
        [[ -d $p || $force == 1 ]] && eval "${path_var}=\"\${${path_var}}:${p}\""
    done
}
