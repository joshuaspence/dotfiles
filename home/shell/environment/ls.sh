#/
## @author Joshua Spence
## @file   ~/.shell/environment/ls.sh
#\

## Unset environment variables. #{{{
    unset LS_COLORS
    unset LS_OPTS
## #}}}

## Make sure `ls` is installed.
command -v ls >/dev/null || return

if $CLICOLOR; then
    ## The `dircolors` command provides color setup for `ls`.
    if command -v dircolors >/dev/null; then
        eval "$(dircolors -b)"
    fi

    ## Alias the `ls` command to automatically use color. #{{{
        LS_OPTS='--color=auto'
        alias ls='ls ${LS_OPTS}'
    ## #}}}
fi
