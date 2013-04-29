#/
## The `python` commands in the "PYTHONSTARTUP" file are executed before the
## first prompt is displayed in interactive mode.
##
## @author Joshua Spence
## @file   ~/.shell/environment/python.sh
#\

# Make sure that `python` is installed.
command -v python >/dev/null || return

# Set and export environment variables.
PYTHONSTARTUP="${HOME}/.pythonrc.py"
if [[ -f $PYTHONSTARTUP && -r $PYTHONSTARTUP ]]; then
    export PYTHONSTARTUP
else
    unset PYTHONSTARTUP
    echo 'No file set for PYTHONSTARTUP environment variable' >&2
fi
