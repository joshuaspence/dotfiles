#/
## Environment variables for `man`.
##
## @author Joshua Spence
## @file   ~/.shell/environment/man.sh
## @link   http://nion.modprobe.de/blog/archives/572-less-colors-for-man-pages.html
#\

# Make sure `man` is installed.
command -v man >/dev/null || return

# The pager to use with the `man` command.
[[ -n $PAGER ]] || source "${HOME}/.shell/environment/pager.sh"
if [[ -n $PAGER ]]; then
    export MANPAGER="${PAGER}"
else
    unset MANPAGER
    echo 'No command set for MANPAGER environment variable' >&2
fi

# Use `less` colors for `man` pages.
if $CLICOLOR; then
    export LESS_TERMCAP_mb=$(printf "${COLOR_RED}")
    export LESS_TERMCAP_md=$(printf "${COLOR_RED}")
    export LESS_TERMCAP_me=$(printf "${COLOR_NC}")
    export LESS_TERMCAP_se=$(printf "${COLOR_NC}")
    export LESS_TERMCAP_so=$(printf "${BG_BLUE}${BOLDCOLOR_YELLOW}")
    export LESS_TERMCAP_ue=$(printf "${COLOR_NC}")
    export LESS_TERMCAP_us=$(printf "${COLOR_GREEN}")
else
    unset LESS_TERMCAP_mb
    unset LESS_TERMCAP_md
    unset LESS_TERMCAP_me
    unset LESS_TERMCAP_se
    unset LESS_TERMCAP_so
    unset LESS_TERMCAP_ue
    unset LESS_TERMCAP_us
fi
