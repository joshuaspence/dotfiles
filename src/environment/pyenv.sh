if test -d "${HOME}/.pyenv"; then
  export PATH="${HOME}/.pyenv/bin:${PATH}"
  eval "$(pyenv init --path)"
  eval "$(pyenv init -)"
fi
