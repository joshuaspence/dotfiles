#/
## @author Joshua Spence
## @file   ~/.shell/functions/string/json_highlight.sh
#\

## Syntax-highlight JSON strings or files.
##
## @link @todo I am not sure where I got this from...
function json_highlight() {
    if [[ -p /dev/stdin ]]; then
        # piping, e.g. `echo '{"foo":42}' | json_highlight`
        python -mjson.tool | pygmentize -l javascript
    else
        # e.g. `json_highlight '{"foo":42}'`
        python -mjson.tool <<< "$*" | pygmentize -l javascript
    fi
}
