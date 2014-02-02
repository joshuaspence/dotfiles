#/
## A shell alias to override the `ls` command such that `ls` will automatically
## use color.
#\

command -v ls &>/dev/null && {
    [[ -n $CLICOLOR ]] || source "${HOME}/.shell/environment/color.sh"

    if $CLICOLOR; then
        alias ls='ls -h --color=auto'
    else
        alias ls='ls -h'
    fi
}
