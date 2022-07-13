function upgrade-all() {
  # Aptitude
  for COMMAND in update upgrade dist-upgrade autoremove autoclean; do
    sudo apt-get "${COMMAND}"
  done

  # ASDF
  asdf update
	asdf plugin-update --all

  # Bingo
  upgrade-bingo

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

function upgrade-bingo() {
  ls ~/.bingo/*.sum | xargs -I{} basename {} .sum | xargs -I{} bingo get {}@latest
}

function upgrade-virtualenv() {
  pip-compile --annotation-style line --upgrade --output-file ~/.venv/requirements.txt --strip-extras --no-emit-index-url ~/.venv/requirements.in
  pip-sync --quiet --pip-args '--disable-pip-version-check' ~/.venv/requirements.txt
}

function upgrade-atlassian-tools() {
  atlas upgrade
  upgrade-cloudtoken
  upgrade-sourcegraph-cli
}

function upgrade-cloudtoken() {
  atlas statlas get --namespace cloudtoken --subdirectory cloudtoken-linux-amd64-latest.zip --output /tmp/cloudtoken.zip
  unzip -d ~/bin -o -q /tmp/cloudtoken.zip
  rm /tmp/cloudtoken.zip
  echo "Cloudtoken upgraded to version $(cloudtoken --version)"
}

function upgrade-sourcegraph-cli() {
  local -r github_repo='sourcegraph/src-cli'
  local -r latest_release=$(gh --repo "${github_repo}" release list --limit 1 | cut --fields 1)
  local -r pattern="src-cli_${latest_release}_linux_amd64.tar.gz"

  gh --repo "${github_repo}" release download "${latest_release}" --dir /tmp --pattern "${pattern}"
  tar --extract --file "/tmp/${pattern}" --directory ~/bin
  rm "/tmp/${pattern}"
  src version --client-only
}
