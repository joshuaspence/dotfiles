HISTCONTROL='ignoreboth'
HISTFILE="${XDG_DATA_HOME:-${HOME}/.local/share}/bash/history"
HISTFILESIZE=1048576
HISTSIZE=1048576

# Exclude certain commands from the history file.
HISTIGNORE='[bf]g:cd *:clear:exit:history:ls:pwd'

# Whenever displaying the prompt, write the previous line to disk.
# See https://unix.stackexchange.com/a/48113.
PROMPT_COMMAND='history -a'

shopt -s cmdhist
shopt -s histappend
shopt -s lithist
