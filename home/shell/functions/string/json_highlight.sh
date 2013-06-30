#/
## A shell function to syntax-highlight JSON strings or files.
##
## @author Joshua Spence
## @file   ~/.shell/functions/string/json_highlight.sh
#\

## Syntax-highlight JSON strings or files.
##
## @param [optional, List] JSON data. If not specified, then data is read from
##                         standard input.
function json_highlight() {
    if [[ -p /dev/stdin ]]; then
        # Piping, e.g. `echo '{"foo":42}' | json_highlight`
        python -mjson.tool | pygmentize -l javascript
    else
        # e.g. `json_highlight '{"foo":42}'`
        python -mjson.tool <<< "$*" | pygmentize -l javascript
    fi
}
