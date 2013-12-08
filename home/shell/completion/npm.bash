#/
## {@link http://www.gnu.org/software/bash/ bash} completion for
## {@link https://npmjs.org/ npm}.
##
## @author Joshua Spence
## @file   ~/.shell/completion/npm.bash
#\

command -v npm &>/dev/null && {
    eval "$(npm completion)"
}
