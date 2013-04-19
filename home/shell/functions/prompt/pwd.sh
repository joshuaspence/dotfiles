#/
## @author Joshua Spence
## @file   ~/.shell/functions/prompt/pwd.sh
#\

function shell_prompt__pwd() {
    $CLICOLOR && echo -n "\[${PROMPT_PWD_COLOR}\]"
                 echo -n '\w'
    $CLICOLOR && echo -n "\[${COLOR_NC}\]"
}
