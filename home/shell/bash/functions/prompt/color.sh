#/
## @author Joshua Spence
## @file   ~/.shell/bash/functions/prompt/colors.sh
#\

## Source prerequisite colors.
[[ -n $COLOR_NC ]] && source "${HOME}/.shell/vars/colors.sh"

## Shell prompt colors. #{{{
    PROMPT_HOST_COLOR="${COLOR_CYAN}"
    PROMPT_PWD_COLOR="${COLOR_GREEN}"
    PROMPT_ROOTUSER_COLOR="${COLOR_RED}"
    PROMPT_TIME_COLOR="${COLOR_BLUE}"
    PROMPT_TTY_COLOR="${COLOR_MAGENTA}"
    PROMPT_USER_COLOR="${COLOR_YELLOW}"
## #}}}
