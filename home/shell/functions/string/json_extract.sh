#/
## @author Joshua Spence
## @file   ~/.shell/functions/string/json_value.sh
#\

## Takes JSON on STDIN and prints the value of a given path on STDOUT.
##
## @param [String] The keys to access the JSON data. Keys are separated by
##                 spaces.
##
## @link http://github.com/fnichol/bashrc/blob/master/bashrc
function json_extract() {
    if [[ $# < 1 || -z $1 ]]; then
        echo 'Usage: json_extract <key1> <key2> ... <keyN>' >&2
        return 1
    fi

    local keys=
    for key in $@; do
        keys="${keys}['${key}']"
    done
    unset key

    python -c 'import sys; import json; j=json.loads(sys.stdin.read()); print j'$keys';'
}
