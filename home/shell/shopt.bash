#!/bin/bash

# Minor errors in the spelling of a directory will be corrected when using the
# `cd` command.
shopt -s cdspell

# Check the window size after each command and, if necessary, updates the values
# of LINES and COLUMNS.
shopt -s checkwinsize

# Includes filenames beginning with a "." in the results of filename expansion.
#shopt -s dotglob

# If set, aliases are expanded. This option is enabled by default for
# interactive shells.
shopt -s expand_aliases

# The history list is appended to the history file when the shell exits, rather
# than overwriting the history file.
shopt -s histappend

# Attempt to perform hostname completion when a word containing a "@" is being
# completed. This option is enabled by default.
shopt -s hostcomplete

# Allow a word beginning with "#" to cause that word and all remaining
# characters on that line to be ignored in an interactive shell. This option is
# enabled by default.
shopt -s interactive_comments

# Case-insensitive globbing (used in pathname expansion).
shopt -s nocaseglob

# Will not attempt to search the PATH for possible completions when completion
# is attempted on an empty line.
shopt -s no_empty_cmd_completion

# The source built-in uses the value of PATH to find the directory containing
# the file supplied as an argument. This option is enabled by default.
shopt -s sourcepath
