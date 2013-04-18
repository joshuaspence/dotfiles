#/
## @author Joshua Spence
## @file   ~/.shell/functions/useless/matrix2.sh
#\

## Cool "The Matrix" type screens.
##
## @link @todo I am not sure where I got this from...
function matrix2() {
    echo -ne '\e[32m'
    while true; do
        echo -ne "\e[$(($RANDOM % 2 + 1))m"
        tr -c '[:print:]' ' ' </dev/urandom |
        dd count=1 bs=50 2>/dev/null
    done
}
