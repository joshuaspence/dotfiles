load ../helper

function setup() {
  load src/functions/open.sh
}

function teardown() {
  unalias open
}

@test 'alias is defined' {
  run alias open
  assert_success
}
