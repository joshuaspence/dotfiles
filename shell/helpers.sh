# shellcheck shell=sh

command_exists() {
  command -v "${1}" >/dev/null
}
