#/
## A shell function to echo the username for the
## {@link http://www.gnu.org/software/bash/ bash} prompt statement.
##
## @author Joshua Spence
## @file   ~/.shell/bash/functions/prompt/user.sh
#\

[[ -n $CLICOLOR ]] || source "${HOME}/.shell/environment/color.sh"
[[ -n $PROMPT_HOST_COLOR ]] || source "${HOME}/.shell/bash/functions/prompt/colors.sh"

function shell_prompt__user() {
    $CLICOLOR && echo -n "\[\$([[ \${EUID} == 0 ]] && echo -n '${PROMPT_ROOTUSER_COLOR}' || echo -n '${PROMPT_USER_COLOR}')\]"
                 echo -n '\u'
    $CLICOLOR && echo -n "\[${COLOR_NC}\]"
}
