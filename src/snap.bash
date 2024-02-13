function snap() {
  local -r name="$1"
  command snap list "${name}" &>/dev/null || sudo command snap install "${name}"
}
