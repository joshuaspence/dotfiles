function lowercase-extensions() {
  find "$1" -type f -print0 | xargs --null rename --verbose 's/\.[^.]*[A-Z][^.]*$/\L$&/'
}
