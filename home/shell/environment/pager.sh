#/
## "PAGER" defines the utility used to display long text by commands such as
## `man`.
##
## @author Joshua Spence
## @file   ~/.shell/environment/pager.sh
#\

if command -v less >/dev/null; then
    export PAGER=$(command -v less)
elif command -v more >/dev/null; then
    export PAGER=$(command -v more)
else
    unset PAGER
    echo 'No command set for PAGER environment variable' >&2
fi
