#/
## A shell function to list hosts defined in `~/.ssh/config`.
##
## @author Joshua Spence
## @file   ~/.shell/functions/network/sshlist.sh
#\

## List hosts defined in `~/.ssh/config`.
##
## @param [optional, String] The ssh_config file. Defaults to `~/.ssh/config`.
function sshlist() {
    if [[ $# > 0 && ! -f $1 ]]; then
        echo "'$1' is not a valid file" >&2
        return 2
    fi

    awk '$1 ~ /Host$/ && $2 != "*" { for (i=2; i<=NF; i++) print $i }' "${1:-${HOME}/.ssh/config}"
}
