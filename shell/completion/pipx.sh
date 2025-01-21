# shellcheck shell=sh

if command_exists pipx; then
  eval "$(register-python-argcomplete pipx)"
fi
