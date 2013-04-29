#/
## A shell function to output a cool "The Matrix" type screen.
##
## @author Joshua Spence
## @file   ~/.shell/functions/useless/matrix1.sh
#\

## Cool "The Matrix" type screen.
function matrix1() {
    echo -e '\e[32m'
    while true; do
        local i
        local v
        for i in $(seq 1 $(($(tput cols)/5))); do
            local r
            r=$((${RANDOM} % 2))
            if [[ $((${RANDOM} % 5)) == 1 ]]; then
                if [[ $((${RANDOM} % 4)) == 1 ]]; then
                    v+="\e[1m ${r}   "
                else
                    v+="\e[2m ${r}   "
                fi
            else
                v+='     '
            fi
        done
        echo -e "${v}"
    done
}
