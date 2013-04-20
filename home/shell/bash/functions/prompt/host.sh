#/
## @author Joshua Spence
## @file   ~/.shell/functions/prompt/host.sh
#\

function shell_prompt__host() {
    $CLICOLOR && echo -n "\[${PROMPT_HOST_COLOR}\]"
                 echo -n '\H'
    $CLICOLOR && echo -n "\[${COLOR_NC}\]"
}
