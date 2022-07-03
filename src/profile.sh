if test -n "${BASH_VERSION}" && test -f "${HOME}/.bashrc"; then
  . "${HOME}/.bashrc"
fi

includex environment/**.sh
includex setup/**.sh
