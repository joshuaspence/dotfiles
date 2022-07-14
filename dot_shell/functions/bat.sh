# shellcheck disable=SC2139
if command -v batcat &>/dev/null; then
  alias bat='batcat'
  alias cat='batcat --paging=never'
fi
