#/
## @author Joshua Spence
## @file   ~/.shell/functions/notification/alert.sh
#\

## Add an `alert` alias for long running commands. Use like so:
##   `sleep 10; alert`
##
## Another example:
##   `( sleep 5 && alert "slept OK" || alert "sleep failed" ) &`
##
## @param [optional, String] The alert text.
##
## @link @todo I am not sure where I got this from...
function alert() {
    notify-send --urgency=low \
        -i $([[ $? == 0 ]] && echo 'terminal' || echo 'error') \
        "$([[ $# == 0 ]] \
            && history | tail -n 1 | sed -e 's/^\s*[0-9]\+\s*//;s/^\[[0-9 :-]*\]\s*//;;s/[;&|]\s*alert$//' \
            || echo "$@" \
        )"
}
