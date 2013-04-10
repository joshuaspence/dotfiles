#!/bin/bash

# A command name that is the name of a directory is executed as if it were the
# argument to the `cd` command.
shopt -s autocd

# Minor errors in the spelling of a directory will be corrected when using the
# `cd` command.
shopt -s cdspell

# Check the window size after each command and, if necessary, updates the values
# of LINES and COLUMNS.
shopt -s checkwinsize

# Bash attempts to save all lines of a multiple-line command in the same history
# entry.
shopt -s cmdhist

# If set, aliases are expanded. This option is enabled by default for
# interactive shells.
shopt -s expand_aliases

# The extended pattern matching features are enabled.
shopt -s extglob

# If set, patterns which fail to match filenames during filename expansion
# result in an expansion error.
shopt -u failglob

# The history list is appended to the history file when the shell exits, rather
# than overwriting the history file.
shopt -s histappend

# If set, and Readline is being used, a user is given the opportunity to re-edit
# a failed history substitution.
shopt -s histreedit

# If set, and Readline is being used, the results of history substitution are
# not immediately passed to the shell parser. Instead, the resulting line is
# loaded into the Readline editing buffer, allowing further modification.
shopt -s histverify

# Attempt to perform hostname completion when a word containing a "@" is being
# completed. This option is enabled by default.
shopt -s hostcomplete

# If set, Bash will send "SIGHUP" to all jobs when an interactive login shell
# exits.
#shopt -s huponexit

# Allow a word beginning with "#" to cause that word and all remaining
# characters on that line to be ignored in an interactive shell. This option is
# enabled by default.
shopt -s interactive_comments

# If enabled, and the "cmdhist" option is enabled, multi-line commands are saved
# to the history with embedded newlines rather than using semicolon separators
# where possible.
shopt -u lithist

# Case-insensitive globbing (used in pathname expansion).
shopt -s nocaseglob

# Will not attempt to search the PATH for possible completions when completion
# is attempted on an empty line.
shopt -s no_empty_cmd_completion

# The programmable completion facilities are enabled. This option is enabled by
# default.
shopt -s progcomp

# Prompt strings undergo parameter expansion, command substitution, arithmetic
# expansion, and quote removal after being expanded. This option is enabled by
# default.
shopt -s promptvars
