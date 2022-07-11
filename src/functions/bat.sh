# shellcheck disable=SC2139
if command -v batcat &>/dev/null; then
  alias bat='batcat'
  alias batdiff="${HOME}/.local/share/chezmoi/tools/bat-extras/src/batdiff.sh"
  alias batman="${HOME}/.local/share/chezmoi/tools/bat-extras/src/batman.sh"
  alias cat='batcat --paging=never'

  source <("${HOME}/.local/share/chezmoi/tools/bat-extras/src/batpipe.sh")
fi
