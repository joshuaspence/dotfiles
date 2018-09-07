# shellcheck disable=SC2034

# Detect color support.
if [[ -n $COLORTERM || $(tput colors) -gt 2 ]]; then
  CLI_COLOR=true
else
  CLI_COLOR=false
fi

# Detect interactive shell.
if [[ $- == *i* ]]; then
  INTERACTIVE_SHELL=true
else
  INTERACTIVE_SHELL=false
fi

# Detect login shell.
if [[ $0 == -* ]]; then
  LOGIN_SHELL=true
else
  LOGIN_SHELL=false
fi

case "${TERM}" in
  xterm-color|*-256color)
    color_prompt=yes;;
esac
