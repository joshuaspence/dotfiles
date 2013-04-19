#/
## @author Joshua Spence
## @file   ~/.shell/functions/os/linux-flavor.sh
#\

## The flavor of Linux that we are using.
##
## @link @todo I am not sure where I got this from...
function linux-flavor() {
    if [[ -f /etc/redhat-release ]]; then
        awk '{print $1}' /etc/redhat-release
    elif [[ -f /etc/lsb-release ]]; then
        head -n 1 /etc/lsb-release | awk -F= '{print $2}'
    else
        echo "Unable to determine Linux flavor" >&2
        return 1
    fi
}
