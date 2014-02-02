#/
## {@link http://www.gnu.org/software/bash/ bash} completion for
## {@link https://github.com/gruntjs/grunt-cli grunt}.
#\

command -v grunt &>/dev/null && {
    eval "$(grunt --completion=bash)"
}
