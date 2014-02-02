#/
## A shell function to echo the public IP address of this machine.
#\

## Echo the public IP address of this machine.
function whatismyip1() {
    dig +short 'myip.opendns.com' '@resolver1.opendns.com'
}
