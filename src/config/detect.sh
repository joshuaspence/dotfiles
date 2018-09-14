# Detect interactive shell.
# shellcheck disable=SC2034
if [[ $- == *i* ]]; then
  INTERACTIVE_SHELL=true
else
  INTERACTIVE_SHELL=false
fi

# Detect login shell.
# shellcheck disable=SC2034
if shopt -q login_shell; then
  LOGIN_SHELL=true
else
  LOGIN_SHELL=false
fi
