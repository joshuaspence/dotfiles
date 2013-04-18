#/
## @author Joshua Spence
## @file   ~/.shell/functions/web/whatismyip1.sh
#\

## Get my public IP address.
##
## @link @todo I am not sure where I got this from...
function whatismyip1() {
	dig +short 'myip.opendns.com' '@resolver1.opendns.com'
}
