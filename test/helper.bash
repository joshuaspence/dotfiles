load 'tools/bats-assert/load.bash'
load 'tools/bats-support/load.bash'
load 'tools/bats-mock/stub.bash'

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
