#/
## @author Joshua Spence
## @file   ~/.shell/functions/network/sshlist.sh
#\

## List hosts defined in `~/.ssh/config`.
##
## @link @todo I am not sure where I got this from...
function sshlist() {
	awk '$1 ~ /Host$/ && $2 != "*" {print $2}' "${HOME}/.ssh/config"
}
