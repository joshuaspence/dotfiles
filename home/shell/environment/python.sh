#/
## The `python` commands in the "PYTHONSTARTUP" file are executed before the
## first prompt is displayed in interactive mode.
#\

command -v python &>/dev/null && {
    PYTHONSTARTUP="${HOME}/.pythonrc.py"
    if [[ -f $PYTHONSTARTUP ]]; then
        export PYTHONSTARTUP
    else
        unset PYTHONSTARTUP
        echo 'No file set for PYTHONSTARTUP environment variable' >&2
    fi
}
