function upgrade-all() {
  # Aptitude
  for COMMAND in update upgrade dist-upgrade autoremove autoclean; do
    sudo apt-get "${COMMAND}"
  done

  # Snap
  sudo snap refresh

  # Atlas CLI
  atlas upgrade
}
