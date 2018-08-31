HISTCONTROL='ignoreboth'
HISTFILESIZE=1048576
HISTSIZE=1048576

# Exclude certain commands from the history file.
HISTIGNORE='[bf]g:clear:exit:history:ls:pwd'

# Whenever displaying the prompt, write the previous line to disk.
# See https://unix.stackexchange.com/a/48113.
PROMPT_COMMAND='history -a; history -c; history -r'

# Save all lines of a multiple-line command in the same history entry.
shopt -s cmdhist
shopt -s lithist

# Append to the history file, don't overwrite it.
shopt -s histappend
