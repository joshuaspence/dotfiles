# Load completions provided by the `bash-completion` package.
if test -f /usr/share/bash-completion/bash_completion; then
  source /usr/share/bash-completion/bash_completion
elif test -f /etc/bash_completion; then
  source /etc/bash_completion
fi
