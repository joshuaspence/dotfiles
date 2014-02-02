#/
## Detect color support.
#\

if [[ -n $COLORTERM || $(tput colors) > 2 ]]; then
    export CLICOLOR='true'
else
    export CLICOLOR='false'
fi
