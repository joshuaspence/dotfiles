function install_snap() {
  local -r name="$1"
  snap list "${name}" &>/dev/null || sudo snap install "${name}"
}
