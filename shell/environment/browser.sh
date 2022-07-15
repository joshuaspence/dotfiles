if test -n "${DISPLAY}" && command -v google-chrome >/dev/null; then
  export BROWSER='google-chrome'
elif test -n "${DISPLAY}" && command -v firefox >/dev/null; then
  export BROWSER='firefox'
elif command -v lynx >/dev/null; then
  export BROWSER='lynx'
elif test -x '/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe'; then
  export BROWSER='/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe'
else
  # TODO: Should we just always use `open`?
  export BROWSER='open'
fi
