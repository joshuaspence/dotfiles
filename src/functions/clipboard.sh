# TODO: It would be nice if we could add `-in` or `-out` automatically based
# on input/output redirection.
command -v xclip &>/dev/null && {
  alias clipboard='xclip -selection clipboard'
}
