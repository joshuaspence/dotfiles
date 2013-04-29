#/
## A shell function to display the public IP address.
##
## @author Joshua Spence
## @file   ~/.shell/functions/web/whatismyip2.sh
#\

## Get my public IP address.
function whatismyip2() {
    curl -s 'checkip.dyndns.org' |
    grep --color=none -Eo '[0-9]{1,4}(.[0-9]{1,4}){3}'
}
