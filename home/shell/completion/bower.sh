#/
## {@link http://www.gnu.org/software/bash/ bash} completion for
## {@link http://bower.io/ bower}.
##
## @author Joshua Spence
## @file   ~/.shell/completion/bower.bash
#\

command -v bower &>/dev/null && {
    eval "$(bower completion)"
}
