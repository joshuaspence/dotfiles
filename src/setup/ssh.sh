# Create `~/.ssh/connections` (which is used for SSH's `ControlPath` directive)
# if it doesn't exist.
if ! test -d "${HOME}/.ssh/connections"; then
  mkdir --mode 700 "${HOME}/.ssh/connections"
fi
