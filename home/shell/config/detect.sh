# Detect interactive shell.
if [[ $- == *i* ]]; then
  INTERACTIVE_SHELL=true
else
  INTERACTIVE_SHELL=false
fi
