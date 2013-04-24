#/
## @author Joshua Spence
## @file   ~/.shell/bash/shopt.sh
#\

## A command name that is the name of a directory is executed as if it were the
## argument to the `cd` command.
shopt -s autocd

## If set, an argument to the `cd` builtin command that is not a directory is
## assumed to be the name of a variable whose value is the directory to change
## to.
shopt -u cdable_vars

## Minor errors in the spelling of a directory will be corrected when using the
## `cd` command.
shopt -s cdspell

## Check the window size after each command and, if necessary, updates the
## values of "LINES" and "COLUMNS".
shopt -s checkwinsize

## `bash` attempts to save all lines of a multiple-line command in the same
## history entry.
shopt -s cmdhist

## If set, `bash` replaces directory names with the results of word expansion
## when performing filename completion. This changes the contents of the
## readline editing buffer. If not set, `bash` attempts to preserve what the
## user typed.
shopt -u direxpand

## If set, `bash` attempts spelling correction on directory names during word
## completion if the directory name initially supplied does not exist.
shopt -u dirspell

## If set, `bash` includes filenames beginning with a "." in the results of
## pathname expansion.
shopt -s dotglob

## If set, aliases are expanded. This option is enabled by default for
## interactive shells.
shopt -s expand_aliases

## The extended pattern matching features are enabled.
shopt -s extglob

## If set, $'string' and $"string" quoting is performed within ${parameter}
## expansions enclosed in double quotes. This option is enabled by default.
shopt -s extquote

## If set, patterns which fail to match filenames during filename expansion
## result in an expansion error.
shopt -u failglob

## If set, the suffixes specified by the "FIGNORE" shell variable cause words to
## be ignored when performing word completion even if the ignored words are the
## only possible completions. This option is enabled by default.
shopt -s force_fignore

## If set, the pattern "**"" used in a pathname expansion context will match all
## files and zero or more directories and subdirectories. If the pattern is
## followed by a "/", only directories and subdirectories match.
shopt -u globstar

## The history list is appended to the history file when the shell exits, rather
## than overwriting the history file.
shopt -s histappend

## If set, and readline is being used, a user is given the opportunity to
## re-edit a failed history substitution.
shopt -s histreedit

## If set, and readline is being used, the results of history substitution are
## not immediately passed to the shell parser. Instead, the resulting line is
## loaded into the readline editing buffer, allowing further modification.
shopt -s histverify

## Attempt to perform hostname completion when a word containing a "@" is being
## completed. This option is enabled by default.
shopt -s hostcomplete

## If set, `bash` will send "SIGHUP" to all jobs when an interactive login shell
## exits.
shopt -u huponexit

## Allow a word beginning with "#" to cause that word and all remaining
## characters on that line to be ignored in an interactive shell. This option is
## enabled by default.
shopt -s interactive_comments

## If enabled, and the "cmdhist" option is enabled, multi-line commands are
## saved to the history with embedded newlines rather than using semicolon
## separators where possible.
shopt -u lithist

## If set, and a file that bash is checking for mail has been accessed since the
## last time it was checked, the message "The mail in mailfile has been read"
## is displayed.
shopt -u mailwarn

## Will not attempt to search the "PATH" for possible completions when
## completion is attempted on an empty line.
shopt -s no_empty_cmd_completion

## Case-insensitive globbing (used in pathname expansion).
shopt -s nocaseglob

## If set, `bash` matches patterns in a case-insensitive fashion when performing
## matching while executing `case` or `[[` conditional commands.
shopt -u nocasematch

## If set, `bash` allows patterns which match no files to expand to a null
## string, rather than themselves.
shopt -u nullglob

## The programmable completion facilities are enabled. This option is enabled by
## default.
shopt -s progcomp

## Prompt strings undergo parameter expansion, command substitution, arithmetic
## expansion, and quote removal after being expanded. This option is enabled by
## default.
shopt -s promptvars

## If set, the `source` (`.`) builtin uses the value of "PATH" to find the
## directory containing the file supplied as an argument. This option is enabled
## by default.
shopt -s sourcepath
