#/
## "PAGER" defines the utility used to display long text by commands such as
## `man`.
##
## @author Joshua Spence
## @file   ~/.shell/environment/pager.sh
#\

## Unset the environment variable.
unset PAGER

## Set the environment variable.
if command -v less >/dev/null; then
    PAGER=$(command -v less)
elif command -v more >/dev/null; then
    PAGER=$(command -v more)
else
    echo 'No command set for PAGER environment variable' >&2
fi

## Export the environment variable.
export PAGER
