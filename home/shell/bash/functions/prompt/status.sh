#/
## @author Joshua Spence
## @file   ~/.shell/bash/functions/prompt/status.sh
#\

function shell_prompt__set_status() {
    echo -n 'PROMPT_STATUS=$?'
}

function shell_prompt__status() {
    local cross=$(echo -ne '\0342\0234\0227')
    local tick=$(echo -ne '\0342\0234\0223')

    $CLICOLOR && echo -n "\[\$([[ \${PROMPT_STATUS} != 0 ]] && echo -n '${BOLDCOLOR_RED}' || echo -n '${BOLDCOLOR_GREEN}')\]"
                 echo -n "\$([[ \${PROMPT_STATUS} != 0 ]] && echo -n '${cross}' || echo -n '${tick}')"
    $CLICOLOR && echo -n "\[${COLOR_NC}\]"
}
