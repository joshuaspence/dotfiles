#/
## Shell completion for `dropbox`.
##
## @author Torstein Krause Johansen
## @file   ~/.shell/completion/dropbox.sh
## @link   http://github.com/skybert/my-little-friends/blob/master/bash_completion.d/dropbox
#\

function _dropbox() {
    local commands cur opts prev
    _init_completion || return

    COMPREPLY=()
    cur=$(_get_cword "=")
    prev="${COMP_WORDS[COMP_CWORD-1]}"
    commands="autostart exclude filestatus help lansync ls puburl running start status stop"

    _expand || return 0

    # These options are final.
    if [[ ${COMP_WORDS[@]} == *+([[:space:]])@(status|stop|running)+([[:space:]])* ]]; then
        return 0
    fi

    case "${prev}" in
        autostart|lansync)
            COMPREPLY=($(compgen -W 'y n' -- ${cur}))
            return 0
            ;;
        exclude)
            opts='list add remove'
            COMPREPLY=($(compgen -W "${opts}" -- ${cur}))
            ;;
        filestatus)
            opts='-l --list -a --all'
            COMPREPLY=($(compgen -W "${opts}" -- ${cur}))
            ;;
        help)
            COMPREPLY=($(compgen -W "${commands}" -- ${cur}))
            return 0
            ;;
        start)
            local opts='-i --install'
            COMPREPLY=($(compgen -W "${opts}" -- ${cur}))
            ;;
        *)
            ;;
    esac

    COMPREPLY=($(compgen -W "${commands}" -- ${cur}))
    return 0
}

complete -F _dropbox ${nospace} dropbox
