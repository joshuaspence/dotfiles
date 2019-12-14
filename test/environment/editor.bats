load ../helper

function teardown() {
  unset DISPLAY
  unset EDITOR

  unstub subl || true
  unstub vim || true
}

@test '\$EDITOR=subl when \$DISPLAY is set' {
  DISPLAY=:0
  stub subl

  load src/environment/editor.sh
  assert_equal "${EDITOR}" 'subl --new-window --wait'
}

@test '\$EDITOR=vim when \$DISPLAY is not set' {
  stub subl
  stub vim

  load src/environment/editor.sh
  assert_equal "${EDITOR}" vim
}

@test '\$EDITOR=vim' {
  stub vim

  load src/environment/editor.sh
  assert_equal "${EDITOR}" vim
}

@test '\$EDITOR=' {
  load src/environment/editor.sh
  assert_equal "${EDITOR}" ''
}
