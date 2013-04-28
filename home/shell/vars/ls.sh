#/
## @author Joshua Spence
## @file   ~/.shell/vars/ls.sh
#\

## Unset environment variables and aliases. @{{{
    unset LS_OPTS
    unalias ls 2>/dev/null || true
## @}}}

## Make sure `ls` is installed.
command -v ls >/dev/null || return

if $CLICOLOR; then
    ## Alias the `ls` command to automatically use color. @{{{
        LS_OPTS='--color=auto'
        alias ls='ls ${LS_OPTS}'
    ## @}}}
fi
