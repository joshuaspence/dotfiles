#/
## @author Joshua Spence
## @file   ~/.shell/functions/prompt/shell_title.sh
#\

function shell_title() {
    case $TERM in
        xterm* | rxvt*)
            echo -e "\[\e]0;\u@\H:\w [\$(tty):\$SHLVL]\007\]";;
    esac
}
