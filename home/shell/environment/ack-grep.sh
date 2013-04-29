#/
## Environment variables for {@link http://beyondgrep.com/ ack-grep}.
##
## @author Joshua Spence
## @file   ~/.shell/environment/ack-grep.sh
#\

# Make sure `ack-grep` is installed.
command -v ack-grep >/dev/null || return

# Set path to the configuration file for `ack-grep`.
ACKRC="${HOME}/.ackrc"
if [[ -f $ACKRC && -r $ACKRC ]]; then
    export ACKRC
else
    unset ACKRC
    echo 'No file set for ACKRC environment variable' >&2
fi

# Set the pagers for `ack-grep`.
if command -v less >/dev/null; then
    export ACK_PAGER=$(command -v less)

    if $CLICOLOR; then
        export ACK_PAGER_COLOR="${ACK_PAGER} -R"
    else
        unset ACK_PAGER_COLOR
    fi
elif command -v more >/dev/null; then
    export ACK_PAGER=$(command -v more)

    if $CLICOLOR; then
        export ACK_PAGER_COLOR="${ACK_PAGER}"
    else
        unset ACK_PAGER_COLOR
    fi
else
    unset ACK_PAGER
    unset ACK_PAGER_COLOR
    echo 'No command set for ACK_PAGER environment variable' >&2
    echo 'No command set for ACK_PAGER_COLOR environment variable' >&2
fi
