#/
## Environment variables for {@link http://www.greenwoodsoftware.com/less less}.
#\

command -v less &>/dev/null && {
    [[ -n $CLICOLOR ]] || source "${HOME}/.shell/environment/color.sh"

    ## Allow `less` to show color escape sequences.
    if $CLICOLOR; then
        export LESS='-R'
    else
        unset LESS
    fi

    ## Set the `less` input preprocessor.
    if command -v lesspipe &>/dev/null; then
        eval "$(lesspipe)"
    else
        unset LESSOPEN
        unset LESSCLOSE
        echo 'No command set for LESSOPEN environment variable' >&2
        echo 'No command set for LESSCLOSE environment variable' >&2
    fi

    ## Disable `less` history.
    export LESSHISTFILE='-'
}
