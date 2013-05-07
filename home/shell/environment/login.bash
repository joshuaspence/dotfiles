#/
## Detect login shell.
##
## @author Joshua Spence
## @file   ~/.shell/environment/login.bash
#\

if shopt -q login_shell; then
    export LOGIN_SHELL='true'
else
    export LOGIN_SHELL='false'
fi
