function vscode() {
  test -n "${1}" && cd "${1}"

  if test -d .devcontainer; then
    devcontainer open-in-code . "${@:1}"
  else
    code . "${@:1}"
  fi
}
