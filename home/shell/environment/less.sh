#/
## Environment variables for {@link http://www.greenwoodsoftware.com/less less}.
##
## @author Joshua Spence
## @file   ~/.shell/environment/less.sh
#\

# Make sure `less` is installed.
command -v less >/dev/null || return

# Allow `less` to show color escape sequences.
if $CLICOLOR; then
    export LESS='-R'
else
	unset LESS
fi

# The `less` pager supports editing the file being viewed by pressing "v".
[[ -n $EDITOR ]] || source "${HOME}/.shell/environment/editor.sh"
if [[ -n $EDITOR ]]; then
    export LESSEDIT="${EDITOR}"
else
	unset LESSEDIT
	echo 'No command set for LESSEDIT environment variable' >&2
fi

# Set the `less` input preprocessor.
if command -v lesspipe >/dev/null; then
    eval "$(lesspipe)"
else
	unset LESSOPEN
	unset LESSCLOSE
	echo 'No command set for LESSOPEN environment variable' >&2
	echo 'No command set for LESSCLOSE environment variable' >&2
fi

# Set the `lessecho` program.
if command -v lessecho >/dev/null; then
	export LESSECHO=$(command -v lessecho)
else
	unset LESSECHO
	echo 'No command set for LESSECHO environment variable' >&2
fi

# Disable `less` history.
export LESSHISTFILE='-'
export LESSHISTSIZE=0

# Disable `less` emulating `more`.
unset LESS_IS_MORE
