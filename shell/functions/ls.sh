if command -v dircolors >/dev/null; then
  source <(dircolors)
fi

alias ls='ls --color=auto --human-readable'
