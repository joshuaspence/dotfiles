if test -d "${HOME}/.pyenv"; then
  export PATH="${HOME}/.pyenv/bin:${PATH}"

  # TODO: Should these lines be in `~/.bashrc`?
  eval "$(pyenv init -)"
  eval "$(pyenv virtualenv-init -)"
fi
