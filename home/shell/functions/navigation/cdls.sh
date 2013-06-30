#/
## A shell function to change into a directory and then list the directory
## contents.
##
## @author Joshua Spence
## @file   ~/.shell/functions/navigation/cdls.sh
#\

## Changes into the specified directory and then lists the directory contents.
##
## @param [String] The path of the directory.
function cdls() {
    if [[ $# < 1 || -z $1 ]]; then
        echo 'Usage: cdls <path>' >&2
        return 1
    fi

    cd "$1" && ls
}
