# shellcheck shell=sh

if command_exists batcat; then
  alias bat='batcat'
  alias bathelp='batcat --plain --language=help'
  alias cat='batcat --paging=never --style=plain'
fi
