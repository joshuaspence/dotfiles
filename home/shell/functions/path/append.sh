#/
## A shell function to append the specified paths to the end of a search
## path.
#\

## Appends the specified paths to the end of a search path.
##
## @param [String] Search path variable to manipulate (e.g.: "PATH").
## @param [List]   Space-seperated list of paths to append, in order.
##
## @link https://github.com/fnichol/bashrc/blob/master/bashrc
function append-path() {
    if [[ $# < 1 || -z $1 ]]; then
        echo 'Usage: append-path [-f|--force] <path_var> <path1> ... <pathN>' >&2
        return 1
    fi

    local force; if [[ $1 == '-f' || $1 == '--force' ]]; then
        force=1; shift
    else
        force=0
    fi

    local path_var="$1"; shift

    if eval "test -z \"\${${path_var}}\""; then
        [[ -d $1 || $force == 1 ]] && eval "${path_var}=\"$1\""
        shift
    fi

    local p; for p in "$@"; do
        remove-path "${path_var}" "${p}"
        [[ -d $p || $force == 1 ]] && eval "${path_var}=\"\${${path_var}}:${p}\""
    done
}
