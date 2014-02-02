#/
## A shell function to echo the public IP address of this machine.
#\

## Echo the public IP address of this machine.
function whatismyip3() {
    curl -s 'jsonip.com' |
    grep --color=none -Eo '"ip":"[0-9]{1,4}(.[0-9]{1,4}){3}"' |
    grep --color=none -Eo '[0-9]{1,4}(.[0-9]{1,4}){3}'
}
