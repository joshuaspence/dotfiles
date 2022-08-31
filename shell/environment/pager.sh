if command_exists less; then
  if command_exists lesspipe; then
    source <(lesspipe)
  fi

  export PAGER='less'
elif command_exists more; then
  export PAGER='more'
fi
