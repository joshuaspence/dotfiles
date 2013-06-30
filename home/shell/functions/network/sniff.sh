#/
## A shell function to sniff HTTP traffic.
##
## @author Joshua Spence
## @file   ~/.shell/functions/network/sniff.sh
#\

## Sniff HTTP traffic.
##
## @param [String] The interface on which to sniff for HTTP traffic.
##
## @link https://github.com/stevehodgkiss/dotfiles/blob/master/aliases
function sniff() {
    if [[ $# < 1 || -z $1 ]]; then
        echo 'Usage: sniff <interface>' >&2
        return 1
    fi

    sudo ngrep -d "$1" -t '^(GET|POST) ' 'tcp and port 80'
}
