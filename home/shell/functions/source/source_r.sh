#/
## @author Joshua Spence
## @file   ~/.shell/functions/source/source_r.sh
#\

## Recursive source function.
##
## @param [String] The path of the file or directory to source.
function source_r() {
    if [[ $# < 1 || -z $1 ]]; then
        echo "Usage: source_r <path>" >&2
        return 1
    fi

    local file
    for file in $(find "$1" ! -type d -readable 2>/dev/null); do
        source "${file}"
    done
}
