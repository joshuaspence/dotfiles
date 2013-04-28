#/
## The "EDITOR" environment variable declares the editor program called by
## `sudoedit`, `vipw` and other such programs when you tell them to edit a file.
##
## The "VISUAL" environment variable is used to specify the visual
## (screen-oriented) editor. Generally you will want to set it to the same value
## as the "EDITOR" variable.
##
## @author Joshua Spence
## @file   ~/.shell/environment/editor.sh
#\

# Set EDITOR environment variable.
if [[ -n $DISPLAY ]] && command -v subl >/dev/null; then
    export EDITOR="$(command -v subl) -n -w"
elif [[ -n $DISPLAY ]] && command -v sublime-text-2 >/dev/null; then
    export EDITOR="$(command -v sublime-text-2) -n -w"
elif command -v vim >/dev/null; then
    export EDITOR=$(command -v vim)
elif command -v vi >/dev/null; then
    export EDITOR=$(command -v vi)
else
    unset EDITOR
    echo 'No command set for EDITOR environment variable' >&2
fi

# Set VISUAL environment variable.
if [[ -n $EDITOR ]]; then
    export VISUAL="${EDITOR}"
else
    unset VISUAL
    echo 'No command set for VISUAL environment variable' >&2
fi
