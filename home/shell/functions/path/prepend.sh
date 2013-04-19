#/
## @author Joshua Spence
## @file   ~/.shell/functions/path/prepend.sh
#\

command -v remove-path >/dev/null || source "$HOME/.shell/functions/path/remove"

## Prepends paths to the front of a search path variable list.
##
## @param [String] Path variable to manipulate (ex: PATH, PYTHONPATH, etc).
## @param [List] Space-seperated list of system paths to push, in reverse order.
##
## @link http://github.com/fnichol/bashrc/blob/master/bashrc
function prepend-path() {
    local path_var="$1"
    shift

    # Create var if not exists.
    if eval "test -z \"\$$path_var\"" ; then
        [ -d "$1" ] && eval $path_var="$1"
        shift
    fi

    local p
    for p in $@ ; do
        remove-path "$path_var" "$p"
        [ -d "$p" ] && eval $path_var="${p}:\$${path_var}"
    done
}
