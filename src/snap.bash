# shellcheck disable=SC2032,SC2033
function snap() {
  local -r name="$1"
  command snap list "${name}" &>/dev/null || sudo snap install "${name}" "${@:2}"
}
