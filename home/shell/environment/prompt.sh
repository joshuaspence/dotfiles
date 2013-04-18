#/
## @author Joshua Spence
## @file   ~/.shell/environment/prompt.sh
#\

## Unset environment variables. #{{{
    unset PS1
    unset PS2
    unset PS3
    unset PS3
## #}}}

## Source prerequisite fuctions.
if ! ( command -v shell_prompt >/dev/null && command -v shell_title >/dev/null ); then
    command -v sh_source_r >/dev/null || source "$HOME/.shell/functions/source/sh_source_r"

    command -v shell_prompt >/dev/null || sh_source_r "$HOME/.shell/functions/prompt"
    command -v shell_title >/dev/null || sh_source_r "$HOME/.shell/functions/title"
fi

## Set and unset environment variables. #{{{
    export PS1="$(shell_title)$(shell_prompt)"
    export PS2='... > '
    export PS3='#? '
    export PS4='+'
## #}}}
