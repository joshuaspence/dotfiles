#/
## @author Joshua Spence
## @file   ~/.shell/environment/ls.sh
#\

## Unset environment variable.
unset LS_COLORS

## Make sure `ls` is installed.
command -v ls >/dev/null || return

if $CLICOLOR; then
    ## The `dircolors` command provides color setup for `ls`.
    if command -v dircolors >/dev/null; then
        eval "$(dircolors -b)"
    fi
fi

## Export environment variable.
export LS_COLORS
