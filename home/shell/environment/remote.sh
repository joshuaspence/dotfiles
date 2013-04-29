#/
## Check if this is a remote (SSH) connection.
##
## @author Joshua Spence
## @file   ~/.shell/environment/remote.sh
#\

if [[ -n $SSH_TTY || -n $SSH_CLIENT || -n $SSH_CONNECTION ]]; then
    export REMOTE='true'
else
    export REMOTE='false'
fi
