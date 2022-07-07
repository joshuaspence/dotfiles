if command -v vim &>/dev/null; then
  export EDITOR='vim'
else
  unset EDITOR

  # shellcheck disable=SC2016
  echo 'No command set for $EDITOR' >&2
fi
