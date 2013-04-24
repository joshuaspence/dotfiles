#/
## @author Joshua Spence
## @file   ~/.shell/functions/network/primary_ip.sh
#\

## Returns the primary IP address of the system.
##
## @link http://github.com/fnichol/bashrc/blob/master/bashrc
function primary_ip() {
    case $(uname -s) in
        Darwin)
            ifconfig $(iface) |
            grep '^[[:space:]]*inet ' |
            awk '{print $2}'
            ;;
        OpenBSD)
            ifconfig $(iface) |
            grep '^[[:space:]]*inet ' |
            awk '{print $2}'
            ;;
        Linux)
            ifconfig $(iface) |
            grep '^[[:space:]]*inet ' |
            awk '{print $2}' |
            awk -F':' '{print $2}'
            ;;
        SunOS)
            ifconfig $(iface) |
            awk '/^\t*inet / {print $2}'
            ;;
        *)
            echo 'Could not determine primary IP address' >&2
            return 1
            ;;
    esac
}
