#/
## Shell completion for `dropbox`.
##
## @author Torstein Krause Johansen
## @file   ~/.shell/completion/dropbox.sh
## @link   http://github.com/skybert/my-little-friends/blob/master/bash_completion.d/dropbox
#\

function _dropbox() {
    local cur prev commands

    COMPREPLY=()
    cur=$(_get_cword "=")
    prev="${COMP_WORDS[COMP_CWORD-1]}"

    _expand || return 0

    # These options are final.
    if [[ ${COMP_WORDS[@]} == *+([[:space:]])@(status|stop|running)+([[:space:]])* ]]; then
        return 0
    fi

    declare -a commands=( autostart exclude filestatus help lansync ls puburl running start status stop )

    # These options require an argument.
    if [[ $prev == @(autostart exclude filestatus help lansync ls puburl start) ]]; then
        return 0
    fi

    if [[ $COMP_CWORD == 1 ]]; then
        completions=${commands[@]}
    elif [[ $COMP_CWORD == 2 ]]; then
        case $prev in
            autostart|lansync)
                completions='y n';;

            exclude)    completions='list add remove';;
            filestatus) completions='-l --list -a --all';;
            help)       completions=${commands[@]};;
            start)      completions='-i --install';;
            *)          return 1;;
        esac
    else
        return 1
    fi

    COMPREPLY=( $(compgen -W "$completions" -- $cur) )
    return 0
}

complete -F _dropbox ${nospace} dropbox
