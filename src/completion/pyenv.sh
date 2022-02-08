include environment/pyenv.sh

# shellcheck disable=SC2154
if test -n "${PYENV_ROOT}"; then
  source <(pyenv init -)
fi
