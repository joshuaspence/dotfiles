#/
## A shell function to display the public IP address.
##
## @author Joshua Spence
## @file   ~/.shell/functions/web/whatismyip1.sh
#\

## Get my public IP address.
function whatismyip1() {
	dig +short 'myip.opendns.com' '@resolver1.opendns.com'
}
