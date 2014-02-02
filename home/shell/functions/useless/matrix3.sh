#/
## A shell function to output a cool "The Matrix" type screen.
#\

## Cool "The Matrix" type screen.
function matrix3() {
    tr -c '[:digit:]' ' ' </dev/urandom |
    dd cbs=$(tput cols) conv=lcase,unblock |
    GREP_COLOR='1;32' grep --color '[^ ]'
}
