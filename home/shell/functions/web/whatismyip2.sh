#/
## @author Joshua Spence
## @file   ~/.shell/functions/web/whatismyip2.sh
#\

## Get my public IP address.
##
## @link @todo I am not sure where I got this from...
function whatismyip2() {
    curl -s 'checkip.dyndns.org' |
    grep --color=none -Eo '[0-9]{1,4}(.[0-9]{1,4}){3}'
}
