# shellcheck shell=sh

if command_exists vim; then
  export EDITOR='vim'
else
  unset EDITOR

  # shellcheck disable=SC2016
  echo 'No command set for $EDITOR' >&2
fi
