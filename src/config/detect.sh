# Detect color support.
if [[ -n $COLORTERM || $(tput colors) > 2 ]]; then
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
