#/
## The "EDITOR" environment variable declares the editor program called by
## `sudoedit`, `vipw` and other such programs when you tell them to edit a file.
##
## @author Joshua Spence
## @file   ~/.shell/environment/editor.sh
#\

if [[ -n $DISPLAY ]] && command -v subl >/dev/null; then
    export EDITOR="$(command -v subl) -n -w"
elif [[ -n $DISPLAY ]] && command -v sublime >/dev/null; then
    export EDITOR="$(command -v sublime) -n -w"
elif [[ -n $DISPLAY ]] && command -v sublime-text >/dev/null; then
    export EDITOR="$(command -v sublime-text) -n -w"
elif command -v vim >/dev/null; then
    export EDITOR=$(command -v vim)
elif command -v vi >/dev/null; then
    export EDITOR=$(command -v vi)
else
    unset EDITOR
    echo 'No command set for EDITOR environment variable' >&2
fi
