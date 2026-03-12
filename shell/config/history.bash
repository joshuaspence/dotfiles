HISTCONTROL='ignoreboth'
HISTFILE="${XDG_DATA_HOME:-${HOME}/.local/share}/bash/history"
HISTFILESIZE=
HISTIGNORE='[bf]g:cd *:clear:exit:history:ls:pwd'
HISTSIZE=

# Whenever displaying the prompt, write the previous line to disk.
# See https://unix.stackexchange.com/a/48113.
PROMPT_COMMAND+=('history -a')

shopt -s histappend
shopt -s histreedit
shopt -s histverify
shopt -s lithist
