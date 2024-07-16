# shellcheck shell=sh

if command_exists pipx; then
  if command_exists register-python-argcomplete3; then
    eval "$(register-python-argcomplete3 pipx)"
  elif command_exists register-python-argcomplete; then
    eval "$(register-python-argcomplete pipx)"
  fi
fi
