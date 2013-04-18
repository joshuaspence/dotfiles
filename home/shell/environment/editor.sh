#/
## @author Joshua Spence
## @file   ~/.shell/environment/editor.sh
#\

## Unset environment variable.
unset EDITOR

## Set environment variable.
if ! $REMOTE_SHELL && command -v subl >/dev/null; then
    EDITOR="$(command -v subl) -n -w"
elif ! $REMOTE_SHELL && command -v sublime-text-2 >/dev/null; then
    EDITOR="$(command -v sublime-text-2) -n -w"
elif command -v vim >/dev/null; then
    EDITOR=$(command -v vim)
elif command -v vi >/dev/null; then
    EDITOR=$(command -v vi)
else
    echo "No command set for EDITOR environment variable" >&2
fi

## Export environment variable.
export EDITOR
