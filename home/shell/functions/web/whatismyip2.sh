#/
## A shell function to echo the public IP address of this machine.
#\

## Echo the public IP address of this machine.
function whatismyip2() {
    curl -s 'checkip.dyndns.org' |
    grep --color=none -Eo '[0-9]{1,4}(.[0-9]{1,4}){3}'
}
