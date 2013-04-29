#/
## Override the `ls` command with an alias such that `ls` will automatically
## use color.
##
## @author Joshua Spence
## @file   ~/.shell/aliases/override/ls.sh
#\

if $CLICOLOR; then
    alias ls='ls --color=auto'
else
	unalias ls 2>/dev/null || true
fi
