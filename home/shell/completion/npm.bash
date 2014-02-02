#/
## {@link http://www.gnu.org/software/bash/ bash} completion for
## {@link https://npmjs.org/ npm}.
#\

command -v npm &>/dev/null && {
    eval "$(npm completion)"
}
