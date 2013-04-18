#/
## @author Joshua Spence
## @file   ~/.shell/environment/python.sh
#\

## Unset environment variable.
unset PYTHONSTARTUP

## Make sure `python` is installed.
command -v python >/dev/null || return

## The `python` commands in this file are executed before the first prompt is
## displayed in interactive mode.
if [[ -r $HOME/.pythonrc.py ]]; then
    export PYTHONSTARTUP="${HOME}/.pythonrc.py"
fi
