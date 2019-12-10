#!/usr/bin/env bats

load '../../tools/bats-assert/load'
load '../../tools/bats-support/load'

@test "test" {
  load $BATS_TEST_DIRNAME/../../src/functions/shrug.sh
  run shrug

  assert_success
  assert_output '¯\_(ツ)_/¯'
}
