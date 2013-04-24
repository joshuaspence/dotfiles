#/
## @author Joshua Spence
## @file   ~/.shell/bash/functions/prompt/time.sh
#\

function shell_prompt__time() {
    $CLICOLOR && echo -n "\[${PROMPT_TIME_COLOR}\]"
                 echo -n '\t'
    $CLICOLOR && echo -n "\[${COLOR_NC}\]"
}
