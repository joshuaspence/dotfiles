#/
## @author Joshua Spence
## @file   ~/.shell/functions/useless/compute.sh
#\

## Outputs random hexadecimal stuff that makes the screen look busy.
##
## @link @todo I am not sure where I got this from...
function compute() {
	cat /dev/urandom |
	hexdump -C |
	grep --color 'ca fe'
}
