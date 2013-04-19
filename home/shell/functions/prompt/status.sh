#/
## @author Joshua Spence
## @file   ~/.shell/functions/prompt/status.sh
#\

function shell_prompt__status() {
    local cross=$(echo -ne '\0342\0234\0227')
    local tick=$(echo -ne '\0342\0234\0223')

    if $CLICOLOR; then
        echo -n "\[\$([[ \$? != 0 ]] && echo -n '${BOLDCOLOR_RED}\]${cross}' || echo -n '${BOLDCOLOR_GREEN}\]${tick}')\[${COLOR_NC}\]"
    else
        echo -n   "\$([[ \$? != 0 ]] && echo -n '${cross}'                   || echo -n '${tick}')"
    fi
}
