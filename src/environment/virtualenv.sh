if ! test -v VIRTUAL_ENV && test -f "${HOME}/.venv/bin/activate"; then
  # Don't include virtualenv name in prompt
  # (see https://github.com/pypa/virtualenv/issues/5).
  #
  # shellcheck disable=SC2034
  VIRTUAL_ENV_DISABLE_PROMPT=1
  source "${HOME}/.venv/bin/activate"
fi
