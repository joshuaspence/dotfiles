#/
## @author Joshua Spence
## @file   ~/.shell/functions/prompt/tty.sh
#\

function shell_prompt__tty() {
    if [[ $# > 0 && ( $@ == -c || $@ == --color ) ]]; then
        echo -n -e "\[${COLOR_MAGENTA}\]\$(tty)\[${COLOR_NC}\]"
    else
        echo -n -e "\$(tty)"
    fi
}
