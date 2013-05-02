#/
## A shell function to create a desktop notification indicating the exit status
## of a command.
##
## @author Joshua Spence
## @file   ~/.shell/functions/notification/alert.sh
#\

## Create a desktop notification indicating the exit status of a command.
##
## <code>
## sleep 10; alert
## </code>
##
## <code>
## ( sleep 5 && alert "slept OK" || alert "sleep failed" ) &
## </code>
##
## @param [optional, String] The alert text.
function alert() {
    notify-send --urgency=low \
        -i $([[ $? == 0 ]] && echo 'terminal' || echo 'error') \
        "$([[ $# == 0 ]] \
            && history | tail -n 1 | sed -e 's/^\s*[0-9]\+\s*//;s/^\[[0-9 :-]*\]\s*//;;s/[;&|]\s*alert$//' \
            || echo "$@" \
        )"
}
