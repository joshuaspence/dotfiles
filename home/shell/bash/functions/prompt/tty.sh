#/
## A shell function to echo the TTY device for the
## {@link http://www.gnu.org/software/bash/ bash} prompt statement.
##
## @author Joshua Spence
## @file   ~/.shell/bash/functions/prompt/tty.sh
#\

[[ -n $CLICOLOR ]] || source "${HOME}/.shell/environment/color.sh"
[[ -n $PROMPT_HOST_COLOR ]] || source "${HOME}/.shell/bash/functions/prompt/colors.sh"

function shell_prompt__tty() {
    $CLICOLOR && echo -n "\[${PROMPT_TTY_COLOR}\]"
                 echo -n '$(tty)'
    $CLICOLOR && echo -n "\[${COLOR_NC}\]"
}
