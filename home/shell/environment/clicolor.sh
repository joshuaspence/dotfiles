#/
## Detect color support.
##
## @author Joshua Spence
## @file   ~/.shell/environment/clicolor.sh
#\

if [[ -n $COLORTERM || $(tput colors) > 2 ]]; then
    export CLICOLOR='true'
else
    export CLICOLOR='false'
fi
