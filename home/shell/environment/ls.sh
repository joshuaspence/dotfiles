#/
## Environment variable for `ls`.
##
## @author Joshua Spence
## @file   ~/.shell/environment/ls.sh
#\

[[ -n $CLICOLOR ]] || source "${HOME}/.shell/environment/color.sh"

## Use `dircolors` to provide colors for `ls`.
if $CLICOLOR; then
    if command -v dircolors >/dev/null; then
    	eval "$(dircolors -b)"
    else
    	unset LS_COLORS
		echo 'No options set for LS_COLORS environment variable' >&2
	fi
else
	unset LS_COLORS
fi
