if __command_exists batcat; then
  alias bat='batcat'
  alias cat='batcat --paging=never --style=plain'
fi
