BATS_LIB_PATH="$(readlink -f "$(dirname "${1}")/../tools")"

bats_load_library bats-assert
bats_load_library bats-support
bats_load_library bats-mock/stub.bash

function mock_commands() {
  # shellcheck disable=SC1091
  source /dev/stdin <<EOF
function command() {
  case \$2 in
    $(echo "$@" | xargs --no-run-if-empty printf '%s) return 0;;\n    ')*) return 1;;
  esac
}
EOF
}
