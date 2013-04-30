#/
## Echoes the current directory for the
## {@link http://www.gnu.org/software/bash/ bash} prompt statement.
##
## @author Joshua Spence
## @file   ~/.shell/bash/functions/prompt/pwd.sh
#\

function shell_prompt__pwd() {
    $CLICOLOR && echo -n "\[${PROMPT_PWD_COLOR}\]"
                 echo -n '\w'
    $CLICOLOR && echo -n "\[${COLOR_NC}\]"
}
