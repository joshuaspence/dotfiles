# shellcheck shell=sh

if test -n "${DISPLAY+x}"; then
  if command_exists google-chrome; then
    export BROWSER='google-chrome'
  fi
fi
