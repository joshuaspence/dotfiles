#/
## A shell function to echo the title bar for the
## {@link http://www.gnu.org/software/bash/ bash} prompt statement.
#\

function shell_title() {
    local xtitle_start='\[\e]0;'
    local xtitle_finish='\007\]'

    case $TERM in
        xterm*|rxvt*)
            echo -n "${xtitle_start}\u@\H:\w [\$(tty) : \${SHLVL}]${xtitle_finish}";;
    esac
}
