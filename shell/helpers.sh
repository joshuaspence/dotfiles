command_exists() {
  command -v "${1}" >/dev/null
}

completion_exists() {
  complete -p "${1}" >/dev/null 2>/dev/null
}
