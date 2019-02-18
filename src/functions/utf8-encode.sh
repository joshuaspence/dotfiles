# UTF-8-encode a string of Unicode symbols.
function utf8-encode() {
  printf '%s' "$*" | xxd -cols 1 -postscript -u | xargs printf '\\x%s'
  echo
}
