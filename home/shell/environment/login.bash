#/
## Detect login shell.
#\

if shopt -q login_shell; then
    export LOGIN_SHELL='true'
else
    export LOGIN_SHELL='false'
fi
