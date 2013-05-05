#/
## Environment variables for {@link http://www.gnu.org/software/grep/ grep}.
##
## @author Joshua Spence
## @file   ~/.shell/environment/grep.sh
#\

command -v grep >/dev/null || return

[[ -n $CLICOLOR ]] || source "${HOME}/.shell/environment/color.sh"

if $CLICOLOR; then
    export GREP_COLORS='ms=01;31:mc=01;31:sl=:cx=:fn=35:ln=32:bn=32:se=36'
    export GREP_OPTIONS='--color=auto'
else
    unset GREP_COLORS
    unset GREP_OPTIONS
fi
