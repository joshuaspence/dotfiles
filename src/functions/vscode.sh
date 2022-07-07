function vscode() {
  if test -d .devcontainer; then
    devcontainer open-in-code . "$@"
  else
    code . "$@"
  fi
}
