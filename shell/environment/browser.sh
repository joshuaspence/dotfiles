# TODO: This should only be included when `.headless` is `false` (see twpayne/chezmoi#2310).
if test -v DISPLAY; then
  if command_exists google-chrome; then
    export BROWSER='google-chrome'
  fi
fi
