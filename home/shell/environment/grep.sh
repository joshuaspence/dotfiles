#/
## Environment variables for {@link http://www.gnu.org/software/grep/ grep}.
##
## @author Joshua Spence
## @file   ~/.shell/environment/grep.sh
#\

# Unset environment variables.
unset GREP_COLOR
unset GREP_OPTIONS

# Make sure `grep` is installed.
command -v grep >/dev/null || return

# Set and export environment variables.
if $CLICOLOR; then
    export GREP_COLOR='1;33' # bold red
    export GREP_OPTIONS='--color=auto'
fi
