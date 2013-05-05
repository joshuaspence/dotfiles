#/
## Environment variables for {@link http://beyondgrep.com/ ack-grep}.
##
## @author Joshua Spence
## @file   ~/.shell/environment/ack-grep.sh
#\

command -v ack-grep >/dev/null || return

[[ -n $PAGER ]] || source "${HOME}/.shell/environment/pager.sh"

if [[ -n $PAGER ]]; then
    export ACK_PAGER="${PAGER}"
else
    unset ACK_PAGER
    echo 'No command set for ACK_PAGER environment variable' >&2
fi
