# UTF-8-encode a string of Unicode symbols.
function utf8-encode() {
  printf '\\x%s' $(printf "$@" | xxd -postscript -cols 1 -u)
  echo
}
