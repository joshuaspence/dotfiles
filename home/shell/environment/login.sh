#/
## Detect login shell.
##
## @author Joshua Spence
## @file   ~/.shell/environment/login.sh
#\

if shopt -q login_shell; then
    export LOGIN='true'
else
    export LOGIN='false'
fi
