#/
## Configure the {@link http://www.gnu.org/software/bash/ bash} prompt
## statement.
##
## @author Joshua Spence
## @file   ~/.shell/bash/prompt.sh
#\

[[ -n $CLICOLOR ]] || source "${HOME}/.shell/environment/color.sh"
command -v source_r >/dev/null || source "${HOME}/.shell/functions/source/source_r.sh"
command -v shell_prompt >/dev/null || source_r "${HOME}/.shell/bash/functions/prompt/"

PROMPT_COMMAND=$(shell_prompt__set_status)
PS1="$(shell_title)$(shell_prompt)"
PS2='... > '
PS3='#? '
PS4='+'
