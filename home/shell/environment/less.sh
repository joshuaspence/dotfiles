#/
## @author Joshua Spence
## @file   ~/.shell/environment/less.sh
#\

## Unset environment variables. @{{{
    unset LESS
    unset LESSEDIT
    unset LESSOPEN
    unset LESSCLOSE
## @}}}

## Make sure `less` is installed.
command -v less >/dev/null || return

## Source prerequisite environment variables. @{{{
    [[ -n $EDITOR ]] || source "${HOME}/.shell/environment/editor.sh"
## @}}}

## Allow `less` to show color escape sequences.
if $CLICOLOR; then
    export LESS='-R'
fi

## The `less` pager supports editing the file being viewed by pressing "v".
if [[ -n $EDITOR ]]; then
    export LESSEDIT="${EDITOR}"
fi

## Set the `less` input preprocessor.
if command -v lesspipe >/dev/null; then
    eval "$(lesspipe)"
fi
