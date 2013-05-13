#/
## An environment variable used to prevent `env` output from changing console
## color.
##
## @author Joshua Spence
## @file   ~/.shell/environment/env.sh
#\

command -v env &>/dev/null && {
    ## Set to avoid `env` output from changing console color.
    ##
    ## @link https://github.com/rcmachado/dotfiles/blob/master/bash_colors
    export LESS_TERMEND=$'\e[0m'
}
