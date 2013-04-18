#/
## @author Joshua Spence
## @file   ~/.shell/environment/ack-grep.sh
#\

## Unset environment variables. #{{{
    unset ACKRC
    unset ACK_PAGER
    unset ACK_PAGER_COLOR
## #}}}

## Make sure `ack-grep` is installed.
command -v ack-grep >/dev/null || return

## Set path to the configuration file for `ack-grep`. #{{{
    if [[ -r $HOME/.ackrc ]]; then
        ACKRC="${HOME}/.ackrc"
    else
        echo "No path set for ACKRC environment variable" >&2
    fi
## #}}}

## Set the pagers for `ack-grep`. #{{{
    if command -v less >/dev/null; then
        ACK_PAGER=$(command -v less)
        ACK_PAGER_COLOR="${ACK_PAGER} -R"
    elif command -v more >/dev/null; then
        ACK_PAGER=$(command -v more)
        ACK_PAGER_COLOR="${ACK_PAGER}"
    else
        echo "No command set for ACK_PAGER environment variable" >&2
        echo "No command set for ACK_PAGER_COLOR environment variable" >&2
    fi
## #}}}

## Export environment variables. #{{{
    export ACKRC
    export ACK_PAGER
    export ACK_PAGER_COLOR
## #}}}
