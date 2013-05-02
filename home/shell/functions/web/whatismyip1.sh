#/
## A shell function to echo the public IP address of this machine.
##
## @author Joshua Spence
## @file   ~/.shell/functions/web/whatismyip1.sh
#\

## Echo the public IP address of this machine.
function whatismyip1() {
    dig +short 'myip.opendns.com' '@resolver1.opendns.com'
}
