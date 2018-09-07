# TODO: It would be nice if we could add `-in` or `-out` automatically based
# on input/output redirection.
if command -v xclip &>/dev/null; then
  alias clipboard='xclip -selection clipboard'
fi
