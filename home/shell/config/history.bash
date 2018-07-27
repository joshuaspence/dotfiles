# Entries beginning with space aren't added into history, and duplicate
# entries will be erased (leaving the most recent entry).
HISTCONTROL='ignorespace:erasedups'

# Lots of history. 
HISTSIZE=10000000000
HISTFILESIZE="${HISTSIZE}"

# File where the history is stored.
HISTFILE="${HOME}/.bash_history"

# Exclude certain commands from the history file.
HISTIGNORE='cd:history:ls:pwd'
