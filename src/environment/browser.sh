if test -n "${DISPLAY}" && command -v google-chrome &>/dev/null; then
  export BROWSER='google-chrome'
elif test -n "${DISPLAY}" && command -v firefox &>/dev/null; then
  export BROWSER='firefox'
elif command -v lynx &>/dev/null; then
  export BROWSER='lynx'
else
  # TODO: Should we just always use `open`?
  export BROWSER='open'
fi
