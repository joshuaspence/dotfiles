if [ -n "${BASH_VERSION}" ]; then
  # Include `.bashrc` if it exists.
  if [ -f "${HOME}/.bashrc" ]; then
    . "${HOME}/.bashrc"
  fi
fi

includex environment/**.sh
