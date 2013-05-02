#/
## A shell function to echo the IP address of each network adapter.
##
## @author Joshua Spence
## @file   ~/.shell/functions/network/ips.sh
#\

## Echo the IP address of each network adapter.
function ips() {
    ifconfig | grep 'inet ' | awk '{print $2}'
}
