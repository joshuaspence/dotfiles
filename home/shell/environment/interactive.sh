#/
## Detect interactive shell.
#\

if [[ $- == *i* ]]; then
    export INTERACTIVE_SHELL='true'
else
    export INTERACTIVE_SHELL='false'
fi
