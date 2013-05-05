#/
## Shell completion for `dropbox`.
##
## @author Torstein Krause Johansen
## @file   ~/.shell/completion/dropbox.sh
## @link   http://github.com/skybert/my-little-friends/blob/master/bash_completion.d/dropbox
#\

function _dropbox() {
    local cur=${COMP_WORDS[COMP_CWORD]}
    local prev=${COMP_WORDS[COMP_CWORD-1]}

    local commands
    declare -a commands=( autostart exclude filestatus help lansync ls puburl running start status stop )

    ## Default completions is the list of commands.
    completions=${commands[@]}

    COMPREPLY=( $(compgen -W "$completions" -- $cur) )
}

complete -o default -F _dropbox dropbox
