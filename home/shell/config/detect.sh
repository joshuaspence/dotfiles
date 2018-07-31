# Detect color support.
if [[ -n $COLORTERM || $(tput colors) > 2 ]]; then
  CLICOLOR=true
else
  CLICOLOR=false
fi

# Detect interactive shell.
if [[ $- == *i* ]]; then
  INTERACTIVE_SHELL=true
else
  INTERACTIVE_SHELL=false
fi
