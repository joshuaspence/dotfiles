if command -v cloudtoken &>/dev/null; then

  if ! test -d "${HOME}/.config/cloudtoken"; then
    cloudtoken --init
  fi

  # TODO: This doesn't belong here.
  source "${HOME}/.config/cloudtoken/bashrc_additions"
fi
