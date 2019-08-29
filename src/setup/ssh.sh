# Create `~/.ssh/connections` (which is used for SSH's `ControlPath` directive)
# if it doesn't exist.
if ! test -d "${HOME}/.ssh/connections"; then
  mkdir --mode 700 "${HOME}/.ssh/connections"
fi

# Run `ssh-agent` if it's not already running.
# TODO: The agent will terminate with the last Bash session, see
# https://www.daveeddy.com/2017/10/18/persistent-sshagent-on-bash-on-ubuntu-on-windows/.
# TODO: Test if `ssh-agent` is actually running with `ssh-add -l`.
if [[ -v SSH_AGENT_PID ]]; then
  eval "$(ssh-agent -s)"
fi
