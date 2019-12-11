# Taken from https://stackoverflow.com/a/18839557.
copy_function() {
  test -n "$(declare -f "$1")" || return
  eval "${_/$1/$2}"
}

# Taken from https://stackoverflow.com/a/18839557.
rename_function() {
  copy_function "$@" || return
  unset -f "$1"
}

# Overload `load` to source a file relative to the repository root.
rename_function load _load

function load() {
  _load "$(readlink -f "$(dirname "${BASH_SOURCE[0]}")")/../${1}"
}

load 'tools/bats-assert/load.bash'
load 'tools/bats-support/load.bash'
