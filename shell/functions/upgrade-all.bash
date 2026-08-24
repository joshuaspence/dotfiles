function upgrade-all() {
  upgrade-apt
  upgrade-gnome-extensions
  upgrade-mise
  upgrade-snap
  upgrade-drivers
  upgrade-firmware
}

function upgrade-apt() {
  for COMMAND in update upgrade full-upgrade autoremove; do
    sudo apt "${COMMAND}"
  done
}

function upgrade-drivers() {
  sudo ubuntu-drivers install
}

function upgrade-gnome-extensions() {
  gnome-extensions-cli update --user
}

function upgrade-mise() {
  mise upgrade --prune
}

function upgrade-snap() {
  sudo snap refresh
}

function upgrade-firmware() {
  fwupdmgr refresh --force
  fwupdmgr update
}
