#/
## A shell function to echo the return status of the previous command for the
## {@link http://www.gnu.org/software/bash/ bash} prompt statement.
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
