#/
## A shell function to output random hexadecimal stuff that makes the screen
## look busy.
##
## @author Joshua Spence
## @file   ~/.shell/functions/useless/compute.sh
#\

## Outputs random hexadecimal stuff that makes the screen look busy.
function compute() {
	cat /dev/urandom |
	hexdump -C |
	grep --color 'ca fe'
}
