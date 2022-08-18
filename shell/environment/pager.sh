if __command_exists less; then
  if __command_exists lesspipe; then
    source <(lesspipe)
  fi

  export PAGER='less'
elif __command_exists more; then
  export PAGER='more'
fi
