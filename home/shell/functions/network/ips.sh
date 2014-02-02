#/
## A shell function to echo the IP address of each network adapter.
#\

## Echo the IP address of each network adapter.
function ips() {
    ifconfig | grep 'inet ' | awk '{print $2}'
}
