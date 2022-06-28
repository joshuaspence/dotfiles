if test -d "${HOME}/.pyenv"; then
  export PYENV_ROOT="${HOME}/.pyenv"
  export PATH="${PYENV_ROOT}/bin:${PATH}"
  source <(pyenv init --path)

  if test -d "$(pyenv root)/plugins/pyenv-virtualenv"; then
    source <(pyenv virtualenv-init -)
  fi

  if test -d "$(pyenv root)/plugins/pyenv-autoenv"; then
    source <(pyenv autoenv init)
  fi
fi
