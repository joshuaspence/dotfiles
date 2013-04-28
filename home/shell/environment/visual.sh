#/
## @author Joshua Spence
## @file   ~/.shell/environment/visual.sh
#\

## Unset the environment variable.
unset VISUAL

## Source prerequisite environment variable.
[[ -n $EDITOR ]] || source "${HOME}/.shell/environment/editor.sh"

## Set and export environment variable.
if [[ -n $EDITOR ]]; then
    export VISUAL="${EDITOR}"
else
    echo 'No command set for VISUAL environment variable' >&2
fi
