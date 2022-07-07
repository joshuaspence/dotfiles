load ../helper

function setup() {
  unset DISPLAY
}

function teardown() {
  unset -f command
}

@test "\$EDITOR=vim when \$DISPLAY is not set" {
  mock_commands subl vim

  load ../../src/environment/editor.sh
  assert_equal "${EDITOR}" vim
}

@test "\$EDITOR=vim" {
  mock_commands vim

  load ../../src/environment/editor.sh
  assert_equal "${EDITOR}" vim
}

@test "\$EDITOR=" {
  mock_commands

  load ../../src/environment/editor.sh
  assert_equal "${EDITOR}" ''
}
