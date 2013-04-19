#/
## @author Joshua Spence
## @file   ~/.shell/environment/prompt.sh
#\

## Unset environment variables. #{{{
    unset PROMPT_COMMAND
    unset PS1
    unset PS2
    unset PS3
    unset PS3
## #}}}

## Source prerequisite functions. #{{{
    command -v source_r >/dev/null || source "${HOME}/.shell/functions/source/source_r.sh"
    command -v shell_prompt >/dev/null || source_r "${HOME}/.shell/functions/prompt/"
## #}}}

## Set and export environment variables. #{{{
    export PROMPT_COMMAND=$(shell_prompt__set_status)
    export PS1="$(shell_title)$(shell_prompt)"
    export PS2='... > '
    export PS3='#? '
    export PS4='+'
## #}}}
