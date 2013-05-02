#/
## A shell functo to echo the hostname for the
## {@link http://www.gnu.org/software/bash/ bash} prompt statement.
##
## @author Joshua Spence
## @file   ~/.shell/bash/functions/prompt/host.sh
#\

[[ -n $CLICOLOR ]] || source "${HOME}/.shell/environment/color.sh"
[[ -n $PROMPT_HOST_COLOR ]] || source "${HOME}/.shell/bash/functions/prompt/colors.sh"

function shell_prompt__host() {
    $CLICOLOR && echo -n "\[${PROMPT_HOST_COLOR}\]"
                 echo -n '\H'
    $CLICOLOR && echo -n "\[${COLOR_NC}\]"
}
