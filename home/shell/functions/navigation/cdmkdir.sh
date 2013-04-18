#/
## @author Joshua Spence
## @file   ~/.shell/functions/navigation/cdmkdir.sh
#\

## Creates the directory if it doesn't exist, and changes into it.
##
## @param [String] The path of the new directory.
##
## @link @todo
function cdmkdir() {
    if [ -z "$1" ]; then
        echo "Usage: cdmkdir <path>" >&2
        return 1
    fi

    local cd_cmd
    if command -v pushd >/dev/null; then
        cd_cmd=$(command -v pushd)
    else
        cd_cmd=$(command -v cd)
    fi

    mkdir -p "$1" >/dev/null && $cd_cmd "$1" >/dev/null
}
