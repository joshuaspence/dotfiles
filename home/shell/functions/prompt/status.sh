#/
## @author Joshua Spence
## @file   ~/.shell/functions/prompt/status.sh
#\

function shell_prompt__status() {
    local cross='\0342\0234\0227'
    local tick='\0342\0234\0223'

    if [ $# -gt 0 ] && ([ "$@" == "-c" ] || [ "$@" == "--color" ]); then
        echo -n -e "\$([[ \$? != 0 ]] && echo '\[${COLOR_RED}\]${cross}\[${COLOR_NC}\]' || echo '\[${COLOR_GREEN}\]${tick}\[${COLOR_NC}\]')"
    else
        echo -n -e "\$([[ \$? != 0 ]] && echo '${cross}' || echo '${tick}')"
    fi
}
