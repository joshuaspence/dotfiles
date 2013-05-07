#/
## An environment variable used to prevent `env` output from changing console
## color.
##
## @author Joshua Spence
## @file   ~/.shell/environment/termend.sh
#\

## Set to avoid `env` output from changing console color.
##
## @link http://github.com/rcmachado/dotfiles/blob/master/bash_colors
export LESS_TERMEND=$'\e[0m'
