if command -v less &>/dev/null; then
  export PAGER='less --ignore-case --chop-long-lines'
elif command -v more &>/dev/null; then
  export PAGER='more'
else
  unset PAGER
  echo 'No command set for $PAGER' >&2
fi
