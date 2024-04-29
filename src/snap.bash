function snap() {
  local -r name="$1"
  command snap list "${name}" &>/dev/null || command snap install "${name}" "${@:2}"
}
