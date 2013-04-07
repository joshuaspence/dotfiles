# Unset environment variables.
unset HISTCONTROL
unset HISTTIMEFORMAT
unset HISTSIZE
unset HISTFILESIZE
unset HISTFILE
unset HISTIGNORE

# Entries beginning with space aren't added into history, and duplicate entries
# will be erased (leaving the most recent entry).
HISTCONTROL='ignorespace:erasedups'

# Give history timestamps.
HISTTIMEFORMAT='[%F %T] '

# Lots of history.
HISTSIZE=10000000000
HISTFILESIZE=$HISTSIZE

# File where history is stored.
HISTFILE=$HOME/.shell_history

# Exclude commands starting with whitespace from the history file.
HISTIGNORE='[ \t]*'

# Export environment variables.
export HISTCONTROL
export HISTTIMEFORMAT
export HISTSIZE
export HISTFILESIZE
export HISTFILE
export HISTIGNORE
