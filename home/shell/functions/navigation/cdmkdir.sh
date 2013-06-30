#/
## A shell function to create a directory and change into the new directory.
##
## @author Joshua Spence
## @file   ~/.shell/functions/navigation/cdmkdir.sh
#\

## Creates the specified directory (if it doesn't exist) and changes into it.
##
## @param [String] The path of the new directory.
function cdmkdir() {
    if [[ $# < 1 || -z $1 ]]; then
        echo 'Usage: cdmkdir <path>' >&2
        return 1
    fi

    if [[ ! -e $1 ]]; then
        mkdir -p "$1"
    fi && cd "$1"
}
