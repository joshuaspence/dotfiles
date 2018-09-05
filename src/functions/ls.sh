# Enable colored output for `ls`.
if [ -x /usr/bin/dircolors ]; then
  eval "$(dircolors --bourne-shell)"
  alias ls='ls --color=auto --human-readable'
fi
