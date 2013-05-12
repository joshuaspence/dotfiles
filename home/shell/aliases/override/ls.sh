#/
## A shell alias to override the `ls` command with an alias such that `ls` will
## automatically use color.
##
## @author Joshua Spence
## @file   ~/.shell/aliases/override/ls.sh
#\

command -v ls &>/dev/null && {
    if $CLICOLOR; then
        alias ls='ls --color=auto'
    else
        unalias ls &>/dev/null || true
    fi
}
