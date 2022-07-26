if test -v DISPLAY; then
  if command -v google-chrome >/dev/null; then
    export BROWSER='google-chrome'
  fi
fi
