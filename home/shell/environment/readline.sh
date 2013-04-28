#/
## @author Joshua Spence
## @file   ~/.shell/environment/readline.sh
#\

## Unset the environment variable.
unset INPUTRC

## Set the environment variable.
INPUTRC="${HOME}/.inputrc"

## Export the environment variable.
if [[ -f $INPUTRC && -r $INPUTRC ]]; then
    export INPUTRC
else
    unset INPUTRC
    echo 'No file set for INPUTRC environment variable' >&2
fi
