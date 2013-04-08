# Entries beginning with space aren't added into history, and duplicate entries
# will be erased (leaving the most recent entry).
export HISTCONTROL='ignorespace:erasedups'

# Give history timestamps.
export HISTTIMEFORMAT='[%F %T] '

# Lots of history.
export HISTSIZE='10000000000'
export HISTFILESIZE="$HISTSIZE"

# File where history is stored.
export HISTFILE="$HOME/.shell_history"

# Exclude commands starting with whitespace from the history file.
export HISTIGNORE='[ \t]*'
