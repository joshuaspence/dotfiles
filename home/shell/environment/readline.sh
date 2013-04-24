#/
## @author Joshua Spence
## @file   ~/.shell/environment/readline.sh
#\

## Unset environment variable.
unset INPUTRC

## Set and export environment variable.
if [[ -r $HOME/.inputrc ]]; then
    export INPUTRC="${HOME}/.inputrc"
fi
