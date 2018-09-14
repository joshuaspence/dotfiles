if test -n "${BASH_VERSION}" && test -f "${HOME}/.bashrc"; then
  . "${HOME}/.bashrc"
fi

# For some reason, `virtualenv` is resetting `$PATH`. As such, we must setup
# `virtualenv` before appending/prepending to `$PATH`.
include environment/virtualenv.sh
includex environment/**.sh
