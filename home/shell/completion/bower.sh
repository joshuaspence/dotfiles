#/
## {@link http://www.gnu.org/software/bash/ bash} completion for
## {@link http://bower.io/ bower}.
#\

command -v bower &>/dev/null && {
    eval "$(bower completion)"
}
