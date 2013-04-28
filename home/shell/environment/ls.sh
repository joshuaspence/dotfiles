#/
## Environment variable to provide colors for `ls`.
##
## @author Joshua Spence
## @file   ~/.shell/environment/ls.sh
#\

# Unset environment variable.
unset LS_COLORS

# Make sure `ls` is installed.
command -v ls >/dev/null || return

# Set environment variable.
if $CLICOLOR; then
    # The `dircolors` command provides color setup for `ls`.
    command -v dircolors >/dev/null; then
        eval "$(dircolors -b)"
    else
        echo 'No options set for LS_COLORS environment variable' >&2
    fi
fi
