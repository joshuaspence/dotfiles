# Load completions provided by the `bash-completion` package.

# shellcheck disable=SC1091
if test -f /usr/share/bash-completion/bash_completion; then
  source /usr/share/bash-completion/bash_completion
elif test -f /etc/bash_completion; then
  source /etc/bash_completion
fi
