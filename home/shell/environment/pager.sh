if command -v less &>/dev/null; then
  export PAGER=$(command -v less)
elif command -v more &>/dev/null; then
  export PAGER=$(command -v more)
else
  unset PAGER
  echo 'No command set for $PAGER' >&2
fi
