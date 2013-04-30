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

# Set the `less` input preprocessor.
if command -v lesspipe >/dev/null; then
    eval "$(lesspipe)"
else
	unset LESSOPEN
	unset LESSCLOSE
	echo 'No command set for LESSOPEN environment variable' >&2
	echo 'No command set for LESSCLOSE environment variable' >&2
fi

# Disable `less` history.
export LESSHISTFILE='-'
export LESSHISTSIZE=0
