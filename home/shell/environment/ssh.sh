#/
## Environment variable for {@link http://www.openssh.org/ SSH}.
##
## @author Joshua Spence
## @file   ~/.shell/environment/ssh.sh
#\

command -v ssh &>/dev/null && {
    ## Setup the SSH authentication agent, if it hasn't already been setup.
    if command -v ssh-agent &>/dev/null && [[ -z $SSH_AGENT_PID ]]; then
        eval "$(ssh-agent -s)"
    fi
}
