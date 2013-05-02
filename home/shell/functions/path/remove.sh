#/
## A shell function to remove the specified paths from a search path.
##
## @author Joshua Spence
## @file   ~/.shell/functions/path/remove.sh
#\

## Removes the specified paths from a search path.
##
## @param [String] Search path variable to manipulate (e.g. "PATH").
## @param [List]   Space-separated list of paths to remove.
##
## @link http://github.com/fnichol/bashrc/blob/master/bashrc
function remove-path() {
    if [[ $# < 1 || -z $1 ]]; then
        echo 'Usage: remove-path <path_var> <path1> ... <pathN>' >&2
        return 1
    fi

    local path_var="$1"; shift
    local p; for p in "$@"; do
        eval $path_var=$(
            eval "echo \"\${${path_var}}\"" |
            tr ':' '\n' |
            grep -v "^${p}$" |
            tr '\n' ':' |
            sed -e 's/:$//'
        )
    done
}
