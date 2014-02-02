#/
## Environment variables for {@link http://www.openssh.org/ SSH}.
#\

command -v ssh &>/dev/null && {
    ## Setup the SSH authentication agent, if it hasn't already been setup.
    if command -v ssh-agent &>/dev/null && [[ -z $SSH_AGENT_PID ]]; then
        eval "$(ssh-agent)"
    fi
}
