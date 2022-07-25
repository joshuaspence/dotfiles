function upgrade-all() {
  # Aptitude
  for COMMAND in update upgrade dist-upgrade autoremove autoclean; do
    sudo apt-get "${COMMAND}"
  done

  # ASDF
  asdf update
  asdf plugin-update --all

  # Flatpak
  flatpak update

  # Gnome Extensions
  gnome-extensions-cli update

  # Snap
  sudo snap refresh

  # Virtualenv
  upgrade-virtualenv

  # Firmware
  fwupdmgr refresh --force
  fwupdmgr update
}

function upgrade-virtualenv() {
  pip-compile --annotation-style line --upgrade --output-file ~/.venv/requirements.txt --strip-extras --no-emit-index-url ~/.venv/requirements.in
  pip-sync --quiet --pip-args '--disable-pip-version-check' ~/.venv/requirements.txt
}

function upgrade-atlassian-tools() {
  atlas upgrade
  upgrade-cloudtoken
}

function upgrade-cloudtoken() {
  atlas statlas get --namespace cloudtoken --subdirectory cloudtoken-linux-amd64-latest.zip --output /tmp/cloudtoken.zip
  unzip -d ~/bin -o -q /tmp/cloudtoken.zip
  rm /tmp/cloudtoken.zip
  echo "Cloudtoken upgraded to version $(cloudtoken --version)"
}
