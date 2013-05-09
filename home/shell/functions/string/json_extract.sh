#/
## A shell function to extract fields from JSON data.
##
## @author Joshua Spence
## @file   ~/.shell/functions/string/json_value.sh
#\

## Takes JSON on standard input and prints the value of a given path on standard
## output.
##
## <code>
## echo '{"foo": {"bar": false}}' | json_extract foo bar
## </code>
##
## @param [String] The keys to access the JSON data. Keys are separated by
##                 spaces.
##
## @link  http://github.com/fnichol/bashrc/blob/master/bashrc
function json_extract() {
    if [[ $# < 1 || -z $1 ]]; then
        echo 'Usage: json_extract <key1> <key2> ... <keyN>' >&2
        return 1
    fi

    local key
    local keys
    for key in $@; do
        keys="${keys}['${key}']"
    done

    python -c "import sys; import json; j=json.loads(sys.stdin.read()); print j${keys};"
}
