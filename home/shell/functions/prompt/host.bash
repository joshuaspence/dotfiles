#/
## A shell functo to echo the hostname for the
## {@link http://www.gnu.org/software/bash/ bash} prompt statement.
##
## @author Joshua Spence
## @file   ~/.shell/functions/prompt/host.bash
#\

[[ -n $CLICOLOR ]] || source "${HOME}/.shell/environment/color.sh"
[[ -n $PROMPT_HOST_COLOR ]] || source "${HOME}/.shell/functions/prompt/colors.bash"

function shell_prompt__host() {
    $CLICOLOR && echo -n "\[${PROMPT_HOST_COLOR}\]"
                 echo -n '\H'
    $CLICOLOR && echo -n "\[${COLOR_NC}\]"
}
