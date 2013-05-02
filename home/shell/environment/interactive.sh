#/
## Detect interactive shell.
##
## @author Joshua Spence
## @file   ~/.shell/environment/interactive.sh
#\

if [[ $- == *i* ]]; then
    export INTERACTIVE_SHELL='true'
else
    export INTERACTIVE_SHELL='false'
fi
