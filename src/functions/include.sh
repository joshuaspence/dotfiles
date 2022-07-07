# TODO: Use globs in bash.
function _dotfiles_include() {
  while IFS= read -r -d '' FILE; do
    . "${FILE}"
  done < <(find ~/dotfiles/"$1" -regex ".*\.\($0\|sh\)$")
}
