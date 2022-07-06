# shellcheck disable=SC2139
if command -v batcat &>/dev/null; then
  alias bat='batcat'
  alias batdiff="${HOME}/dotfiles/src/modules/bat-extras/src/batdiff.sh"
  alias batman="${HOME}/dotfiles/src/modules/bat-extras/src/batman.sh"
  alias cat='batcat --paging=never'

  source <("${HOME}/dotfiles/src/modules/bat-extras/src/batpipe.sh")
fi
