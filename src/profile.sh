if [ -n "${BASH_VERSION}" ]; then
  # Include `.bashrc` if it exists.
  if [ -f "${HOME}/.bashrc" ]; then
    . "${HOME}/.bashrc"
  fi
fi

# For some reason, `virtualenv` is resetting `$PATH`. As such, we must setup
# `virtualenv` before appending/prepending to `$PATH`.
include environment/virtualenv.sh
includex environment/**.sh
