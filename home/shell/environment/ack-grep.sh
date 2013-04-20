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
        echo 'No path set for ACKRC environment variable' >&2
    fi
## #}}}

## Set the pagers for `ack-grep`. #{{{
    if command -v less >/dev/null; then
        ACK_PAGER=$(command -v less)
        
        if $CLICOLOR; then
            ACK_PAGER_COLOR="${ACK_PAGER} -R"
        fi
    elif command -v more >/dev/null; then
        ACK_PAGER=$(command -v more)

        if $CLICOLOR; then
            ACK_PAGER_COLOR="${ACK_PAGER}"
        fi
    else
        echo 'No command set for ACK_PAGER environment variable' >&2

        if $CLICOLOR; then
            echo 'No command set for ACK_PAGER_COLOR environment variable' >&2
        fi
    fi
## #}}}

## Export environment variables. #{{{
    export ACKRC
    export ACK_PAGER
    export ACK_PAGER_COLOR
## #}}}
