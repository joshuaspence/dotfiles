#/
## A shell function to display the public IP address.
##
## @author Joshua Spence
## @file   ~/.shell/functions/web/whatismyip3.sh
#\

## Get my public IP address.
function whatismyip3() {
    curl -s 'jsonip.com' |
    grep --color=none -Eo '"ip":"[0-9]{1,4}(.[0-9]{1,4}){3}"' |
    grep --color=none -Eo '[0-9]{1,4}(.[0-9]{1,4}){3}'
}
