# TODO: Use globs in bash.
function _dotfiles_include() {
  for FILE in $(find ~/dotfiles/"$1" -regex ".*\.\($0\|sh\)$"); do
    . "${FILE}"
  done
}
