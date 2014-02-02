#/
## The "VISUAL" environment variable is used to specify the visual
## (screen-oriented) editor. Generally you will want to set it to the same value
## as the "EDITOR" environment variable.
#\

[[ -n $EDITOR ]] || source "${HOME}/.shell/environment/editor.sh"

if [[ -n $EDITOR ]]; then
    export VISUAL="${EDITOR}"
else
    unset VISUAL
    echo 'No command set for VISUAL environment variable' >&2
fi
