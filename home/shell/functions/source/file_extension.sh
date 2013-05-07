#/
## A shell function to extract the file extension from a given path.
##
## @author Joshua Spence
## @file   ~/.shell/functions/source/file_extension.sh
#\

## Extract the file extension from a given path.
##
## @param [String] The path of the file.
function file_extension() {
    if [[ $# < 1 || -z $1 ]]; then
        echo 'Usage: file_extension <path>' >&2
        return 1
    fi

    if test "${1#*.}" != "$1"; then
        echo "${1#*.}"
    fi
}
