#/
## Alias the `ls` command to automatically use color.
##
## @author Joshua Spence
## @file   ~/.shell/vars/ls.sh
#\

# Unset environment variables and aliases.
if command -v ls >/dev/null $CLICOLOR; then    
    LS_OPTS='--color=auto'
    alias ls='/ls ${LS_OPTS}'
else
	unset LS_OPTS
	unalias ls 2>/dev/null || true
fi
