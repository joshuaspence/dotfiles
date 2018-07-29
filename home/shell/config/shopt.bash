# Minor errors in the spelling of a directory component in a `cd` command
# will be corrected.
shopt -s cdspell

# Save all lines of a multiple-line command in the same history entry.
shopt -s cmdhist

# Check the window size after each command and, if necessary, update the 
# values of `$LINES` and `$COLUMNS`.
shopt -s checkwinsize

# Attempt spelling correction on directory names during word completion if the
# directory name initially supplied does not exist.
shopt -s dirspell

# Enable extended pattern matching.
shopt -s extglob

# The pattern `**` used in a filename expansion context will match all files
# and zero or more directories and subdirectories.
shopt -s globstar

# Append to the history file, don't overwrite it.
shopt -s histappend
