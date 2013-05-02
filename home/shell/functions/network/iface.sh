#/
## A shell function to echo the primary network interface.
##
## @author Joshua Spence
## @file   ~/.shell/functions/network/iface.sh
#\

## Echo the primary network interface.
function iface() {
    case "$(uname -s)" in
        Darwin)
            netstat -nr |
            grep '^default' |
            grep -v 'link#' |
            awk '{print $6}'
            ;;
        OpenBSD)
            netstat -nr |
            grep '^default' |
            awk '{print $8}'
            ;;
        Linux)
            netstat -nr |
            grep '^0\.0\.0\.0' |
            awk '{print $8}'
            ;;
        SunOS)
            local def_gateway=$(netstat -nr | grep ^default | awk '{print $2}')
            route get $def_gateway |
            grep '^[ ]*interface:' |
            awk '{print $2}'
            ;;
        *)
            echo 'Could not determine primary network interface' >&2
            return 1
            ;;
    esac
}
