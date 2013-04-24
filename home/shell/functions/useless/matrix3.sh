#/
## @author Joshua Spence
## @file   ~/.shell/functions/useless/matrix3.sh
#\

## Cool "The Matrix" type screens.
##
## @link @todo I am not sure where I got this from.
function matrix3() {
	tr -c '[:digit:]' ' ' </dev/urandom |
	dd cbs=$(tput cols) conv=lcase,unblock |
	GREP_COLOR='1;32' grep --color=always '[^ ]'
}
