if test -v DISPLAY && command -v subl &>/dev/null; then
  export EDITOR='subl --new-window --wait'
elif command -v vim &>/dev/null; then
  export EDITOR='vim'
else
  unset EDITOR

  # shellcheck disable=SC2016
  echo 'No command set for $EDITOR' >&2
fi
