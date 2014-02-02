#/
## A shell function to list hosts defined in `~/.ssh/config`.
#\

## List hosts defined in `~/.ssh/config`.
##
## @param [optional, String] The ssh configuration file. Defaults to
##                           `~/.ssh/config`.
function sshlist() {
    if [[ $# > 0 && ! -f $1 ]]; then
        echo "'$1' is not a valid file" >&2
        return 2
    fi

    awk '$1 ~ /Host$/ && $2 != "*" { for (i=2; i<=NF; i++) print $i }' "${1:-${HOME}/.ssh/config}"
}
