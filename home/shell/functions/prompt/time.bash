#/
## A shell function to echo the time for the
## {@link http://www.gnu.org/software/bash/ bash} prompt statement.
#\

function shell_prompt__time() {
    $CLICOLOR && echo -n "\[${PROMPT_TIME_COLOR}\]"
                 echo -n '\t'
    $CLICOLOR && echo -n "\[${COLOR_NC}\]"
}
