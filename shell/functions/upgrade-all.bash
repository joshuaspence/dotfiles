function upgrade-all() {
  upgrade-apt
  upgrade-asdf
  upgrade-gnome-extensions
  upgrade-snap
  upgrade-tpm
  upgrade-vim-plugins
  upgrade-virtualenv
  upgrade-vscode-extensions
  upgrade-firmware
  upgrade-kernel
}

function upgrade-apt() {
  for COMMAND in update upgrade full-upgrade autoremove; do
    sudo apt "${COMMAND}"
  done
}

function upgrade-asdf() {
  asdf update
  asdf plugin-update --all

  asdf plugin list | xargs -I{} asdf install {} latest
  asdf plugin list | xargs -I{} asdf global {} latest
}

function upgrade-gnome-extensions() {
  gnome-extensions-cli update
}

function upgrade-snap() {
  sudo snap refresh
}

function upgrade-tpm() {
  return
}

function upgrade-vim-plugins() {
  return
}

function upgrade-virtualenv() {
  pip-compile --annotation-style line --upgrade --output-file ~/.venv/requirements.txt --allow-unsafe --strip-extras --no-emit-index-url ~/.venv/requirements.in
  pip-sync --quiet --pip-args '--disable-pip-version-check' ~/.venv/requirements.txt
}

function upgrade-vscode-extensions() {
  return
}

function upgrade-firmware() {
  fwupdmgr refresh --force
  fwupdmgr update
}

function upgrade-kernel() {
  mainline --install-latest
  #mainline --uninstall-old
}
