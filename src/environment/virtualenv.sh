if ! test -d "${HOME}/.venv"; then
  virtualenv "${HOME}/.venv"
fi

# Don't include virtualenv name in prompt.
# See https://github.com/pypa/virtualenv/issues/5.
VIRTUAL_ENV_DISABLE_PROMPT=1

if test -f "${HOME}/.venv/bin/activate"; then
  source "${HOME}/.venv/bin/activate"
fi

# TODO: Automatically/periodically install dependencies.
