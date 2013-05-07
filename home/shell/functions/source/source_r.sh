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
## If the argument to this function is a file, then this file will be sourced
## regardless of its extension.
##
## @param [String] The path of the file or directory to source.
function source_r() {
    if [[ $# < 1 || -z $1 ]]; then
        echo 'Usage: source_r <path>' >&2
        return 1
    fi

    if [[ -f $1 && -r $1 ]]; then
        source "$1"
    elif [[ -d $1 && -r $1 ]]; then
        [[ -n $SHELL ]] || source "${HOME}/.shell/config/shell.sh"
        local file; for file in $(find "$1" ! -type d -readable -name '*.sh' -o -name "*.$(basename ${SHELL})" 2>/dev/null); do
            source "${file}"
        done
    else
        echo "'$1' does not exist or is not readable" >&2
        return 2
    fi
}
