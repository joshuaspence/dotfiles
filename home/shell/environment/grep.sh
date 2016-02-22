#/
## Environment variables for {@link http://www.gnu.org/software/grep/ grep}.
#\

command -v grep &>/dev/null && {
    [[ -n $CLICOLOR ]] || source "${HOME}/.shell/environment/color.sh"

    if $CLICOLOR; then
        export GREP_COLORS='ms=01;31:mc=01;31:sl=:cx=:fn=35:ln=32:bn=32:se=36'
    else
        unset GREP_COLORS
    fi
}
