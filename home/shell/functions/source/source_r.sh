#/
## A recursive `source` shell function which also takes into consideration the
## file extension to allow for shell-specific files to be sourced.
##
## @author Joshua Spence
## @file   ~/.shell/functions/source/source_r.sh
#\

## A recursive `source` shell function which also takes into consideration the
## file extension to allow for shell-specific files to be sourced.
##
## All files with the extension ".sh" will be sourced, regardless of the current
## shell. Additionally, this function will source files with the extension
## "*.${SHELL}".
##
## If the argument to this function is a (single) file, then this file will be
## sourced regardless of its extension.
##
## @param [List] The paths of the files or directories to source.
function source_r() {
    if [[ $# < 1 || -z $1 ]]; then
        echo 'Usage: source_r <path> ...' >&2
        return -1
    fi

    local failures=0
    local path; for path in $@; do
        if [[ -f $path && -r $path ]]; then
            source "${path}"
        elif [[ -d $path && -r $path ]]; then
            [[ -n $SHELL ]] || source "${HOME}/.shell/config/shell.sh"
            local file; for file in $(find "$1" ! -type d -readable -name '*.sh' -o -name "*.$(basename ${SHELL})" 2>/dev/null | sort); do
                source "${file}"
            done
        else
            echo "'$1' does not exist or is not readable" >&2
            failures=$(( $failures + 1 ))
        fi
    done
    return $failures
}
