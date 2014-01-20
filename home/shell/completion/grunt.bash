#/
## {@link http://www.gnu.org/software/bash/ bash} completion for
## {@link https://github.com/gruntjs/grunt-cli grunt}.
##
## @author Joshua Spence
## @file   ~/.shell/completion/grunt.bash
#\

command -v aws &>/dev/null && {
    eval "$(grunt --completion=bash)"
}
