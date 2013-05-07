#/
## Environment variables for `ls`.
##
## @author Joshua Spence
## @file   ~/.shell/environment/ls.sh
#\

command -v ls &>/dev/null && {
    [[ -n $CLICOLOR ]] || source "${HOME}/.shell/environment/color.sh"

    ## Use `dircolors` to provide colors for `ls`.
    if $CLICOLOR; then
        if command -v dircolors &>/dev/null; then
            DIRCOLORSRC="${HOME}/.dircolors"
            if [[ -r $DIRCOLORSRC ]]; then
                eval "$(dircolors ${DIRCOLORSRC})"
            else
                eval "$(dircolors)"
            fi
            unset DIRCOLORSRC
        else
            unset LS_COLORS
            echo 'No options set for LS_COLORS environment variable' >&2
        fi
    else
        unset LS_COLORS
    fi
}
