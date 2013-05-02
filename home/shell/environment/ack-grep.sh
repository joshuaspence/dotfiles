#/
## Environment variables for {@link http://beyondgrep.com/ ack-grep}.
##
## @author Joshua Spence
## @file   ~/.shell/environment/ack-grep.sh
#\

command -v ack-grep >/dev/null || return

if command -v less >/dev/null; then
    export ACK_PAGER=$(command -v less)
elif command -v more >/dev/null; then
    export ACK_PAGER=$(command -v more)
else
    unset ACK_PAGER
    echo 'No command set for ACK_PAGER environment variable' >&2
fi
