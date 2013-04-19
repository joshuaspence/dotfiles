#/
## @author Joshua Spence
## @file   ~/.shell/functions/prompt/pwd.sh
#\

function shell_prompt__pwd() {
    if [ $# -gt 0 ] && ([ "$@" == "-c" ] || [ "$@" == "--color" ]); then
        echo -n -e "\[${COLOR_GREEN}\]\w\[${COLOR_NC}\]"
    else
        echo -n -e "\w"
    fi
}
