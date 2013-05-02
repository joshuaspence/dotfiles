#/
## A recursive `source` shell function.
##
## @author Joshua Spence
## @file   ~/.shell/functions/source/source_r.sh
#\

## Recursive `source` function.
##
## @param [String] The path of the file or directory to source.
function source_r() {
    if [[ $# < 1 || -z $1 ]]; then
        echo 'Usage: source_r <path>' >&2
        return 1
    fi

    if [[ -f $1 && -r $1 ]]; then
        source "$1"
    elif [[ -d $1 -r $1 ]]; then
        local file; for file in $(find "$1" ! -type d -readable 2>/dev/null); do
            source "${file}"
        done
    else
        echo "'$1' does not exist or is not readable" >&2
        return 2
    fi
}
