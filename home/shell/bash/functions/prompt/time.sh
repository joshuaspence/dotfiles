#/
## A shell function to echo the time for the
## {@link http://www.gnu.org/software/bash/ bash} prompt statement.
##
## @author Joshua Spence
## @file   ~/.shell/bash/functions/prompt/time.sh
#\

[[ -n $CLICOLOR ]] || source "${HOME}/.shell/environment/color.sh"
[[ -n $PROMPT_HOST_COLOR ]] || source "${HOME}/.shell/bash/functions/prompt/colors.sh"

function shell_prompt__time() {
    $CLICOLOR && echo -n "\[${PROMPT_TIME_COLOR}\]"
                 echo -n '\t'
    $CLICOLOR && echo -n "\[${COLOR_NC}\]"
}
