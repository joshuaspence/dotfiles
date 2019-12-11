load ../helper

@test 'test' {
  load src/functions/shrug.sh
  run shrug

  assert_success
  assert_output '¯\_(ツ)_/¯'
}
