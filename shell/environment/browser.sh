if test -v DISPLAY; then
  if command_exists google-chrome; then
    export BROWSER='google-chrome'
  fi
fi
