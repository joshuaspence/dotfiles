if test -n "${DISPLAY}" && command -v google-chrome &>/dev/null; then
  export BROWSER='google-chrome'
elif test -n "${DISPLAY}" && command -v firefox &>/dev/null; then
  export BROWSER='firefox'
elif command -v lynx &>/dev/null; then
  export BROWSER='lynx'
else
  unset BROWSER

  # shellcheck disable=SC2016
  echo 'No command set for $BROWSER' >&2
fi
