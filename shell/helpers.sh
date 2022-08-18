__command_exists() {
  command -v "${1}" >/dev/null
}

__completion_exists() {
  complete -p "${1}" >/dev/null 2>/dev/null
}
