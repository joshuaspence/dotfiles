function upgrade-all() {
  upgrade-apt
  upgrade-gnome-extensions
  upgrade-snap
  upgrade-virtualenv
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

function upgrade-virtualenv() {
  pip-compile --upgrade --output-file ~/.venv/requirements.txt --config ~/.config/pip-tools.toml ~/.venv/requirements.in
  pip-sync --config ~/.config/pip-tools.toml ~/.venv/requirements.txt
}

function upgrade-firmware() {
  fwupdmgr refresh --force
  fwupdmgr update
}
