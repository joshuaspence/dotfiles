# Enable colored output for `ls`.
if command -v dircolors &>/dev/null; then
  eval "$(dircolors)"
  alias ls='ls --color=auto --human-readable'
else
  alias ls='ls --human-readable'
fi
