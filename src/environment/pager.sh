if command -v less &>/dev/null; then
  export LESS='--ignore-case --chop-long-lines --no-init'
  export PAGER='less'
elif command -v more &>/dev/null; then
  export PAGER='more'
else
  unset PAGER

  # shellcheck disable=SC2016
  echo 'No command set for $PAGER' >&2
fi
