#/
## @author Joshua Spence
## @file   ~/.shell/shell.sh
#\

# Unset variables. #{{{
    unset INTERACTIVE
## #}}}

## Basic shell variables. These should already be setup. #{{{
    : ${HOME=~}
    : ${LOGNAME=$(id -un)}
    : ${UNAME=$(uname)}
## #}}}

## Store the name of the shell.
SHELL="$0"

## Detect color support.
if [[ -n $COLORTERM || $(tput colors) > 2 ]]; then
    CLICOLOR='true'
    source "$HOME/.shell/colors.sh"
else
    CLICOLOR='false'
fi

## Detect interactive shell.
if [[ $- == *i* ]]; then
    NTERACTIVE_SHELL='true'
else
    INTERACTIVE_SHELL='false'
fi

## Detect login shell.
if shopt -q login_shell; then
    LOGIN_SHELL='true'
else
    LOGIN_SHELL='false'
fi

## Check is this is a remote (SSH) connection.
if [[ -n $SSH_TTY || -n $SSH_CLIENT || -n $SSH_CONNECTION ]]; then
    REMOTE_SHELL='true'
else
    REMOTE_SHELL='false'
fi
