#/
## @author Joshua Spence
## @file   ~/.shell/functions/color/colorize.sh
#\

## Prints terminal codes for shell colors.
##
## @param [String] Terminal code keyword (usually a colour).
##
## @link http://github.com/fnichol/bashrc/blob/master/bashrc
## @link http://github.com/wayneeseguin/rvm/blob/master/scripts/color
function colorize() {
    if [[ $# < 1 || -z $1 ]]; then
        echo "Usage: colorize <color_spec>" >&2
        return 1
    fi

    # "setaf" for foreground.
    # "setab" for background.
    local capname='setaf'

    case "$1" in
        b-*  | bold-*      ) tput bold       ;;
        u-*  | underline-* ) set smul         ; unset rmul ;;
        bg-* | background-*) capname='setab' ;;
    esac
    case "$1" in
        black   | *-black  ) tput $capname 0 ;;
        red     | *-red    ) tput $capname 1 ;;
        green   | *-green  ) tput $capname 2 ;;
        yellow  | *-yellow ) tput $capname 3 ;;
        blue    | *-blue   ) tput $capname 4 ;;
        magenta | *-magenta) tput $capname 5 ;;
        cyan    | *-cyan   ) tput $capname 6 ;;
        white   | *-white  ) tput $capname 7 ;;

        # Defaults
        default | *-default) tput $capname 9 ;;
        none               ) tput sgr0       ;;

        *)                   tput sgr0        ; return 1 ;;
    esac
}
