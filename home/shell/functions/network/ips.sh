#/
## @author Joshua Spence
## @file   ~/.shell/functions/network/ips.sh
#\

## Prints IP addresses.
##
## @link @todo I am not sure where I got this from...
function ips() {
	ifconfig |
	grep 'inet ' |
	awk '{print $2}'
}
