if test -v DISPLAY; then
  if __command_exists google-chrome; then
    export BROWSER='google-chrome'
  fi
fi
