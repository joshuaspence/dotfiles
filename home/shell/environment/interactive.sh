#/
## Detect interactive shell.
##
## @author Joshua Spence
## @file   ~/.shell/environment/interactive.sh
#\

if [[ $- == *i* ]]; then
    export INTERACTIVE='true'
else
    export INTERACTIVE='false'
fi
