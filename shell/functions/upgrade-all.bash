function upgrade-all() {
  upgrade-apt
  upgrade-gnome-extensions
  upgrade-snap
  upgrade-firmware
}

function upgrade-apt() {
  for COMMAND in update upgrade full-upgrade autoremove; do
    sudo apt "${COMMAND}"
  done
}

function upgrade-gnome-extensions() {
  gnome-extensions-cli update
}

function upgrade-snap() {
  sudo snap refresh
}

function upgrade-firmware() {
  fwupdmgr refresh --force
  fwupdmgr update
}
