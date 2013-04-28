#/
## @author Joshua Spence
## @file   ~/.shell/vars/shell.sh
#\

# Unset variables. @{{{
    unset SHELL
    unset CLICOLOR
    unset INTERACTIVE
    unset LOGIN
    unset REMOTE
## @}}}

## Basic shell variables. These should already be setup on most systems. @{{{
    : ${HOME=~}
    : ${LOGNAME=$(id -un)}
    : ${UNAME=$(uname)}
## @}}}

## Store the name of the shell.
SHELL="$0"

## Detect color support.
if [[ -n $COLORTERM || $(tput colors) > 2 ]]; then
    CLICOLOR='true'
else
    CLICOLOR='false'
fi

## Detect interactive shell.
if [[ $- == *i* ]]; then
    INTERACTIVE='true'
else
    INTERACTIVE='false'
fi

## Detect login shell.
if shopt -q login_shell; then
    LOGIN='true'
else
    LOGIN='false'
fi

## Check is this is a remote (SSH) connection.
if [[ -n $SSH_TTY || -n $SSH_CLIENT || -n $SSH_CONNECTION ]]; then
    REMOTE='true'
else
    REMOTE='false'
fi
