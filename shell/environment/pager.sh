if command -v less >/dev/null; then
  if command -v lesspipe >/dev/null; then
    source <(lesspipe)
  fi

  export PAGER='less'
elif command -v more >/dev/null; then
  export PAGER='more'
fi
