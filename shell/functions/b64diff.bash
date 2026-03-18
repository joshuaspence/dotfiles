function b64diff() {
  if (( $# != 2 )); then
    echo 'Usage: b64diff <base64_data> <base64_data>' >&2
    return 1
  fi

  diff --unified \
    <(printf '%s' "$1" | base64 --decode | gunzip --force) \
    <(printf '%s' "$2" | base64 --decode | gunzip --force)
}
