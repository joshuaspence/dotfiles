#/
## {@link http://www.gnu.org/software/bash/ bash} completion for
## {@link https://www.dropbox.com/install?os=lnx Dropbox}.
#\

command -v dropbox &>/dev/null && {
    function _dropbox() {
        _init_completion || return

        local commands='autostart exclude filestatus help lansync ls puburl running start status stop'

        if [[ $cword < 2 ]]; then
            COMPREPLY=($(compgen -W "${commands}" -- $cur))
        else
            case ${words[1]} in
                autostart|lansync)
                    if [[ $cword < 3 ]]; then
                        COMPREPLY=($(compgen -W 'n y' -- $cur))
                    fi
                    ;;
                exclude)
                    if [[ $cword < 3 ]]; then
                        COMPREPLY=($(compgen -W 'add list remove' -- $cur))
                    elif [[ ${words[2]} == @(add|remove) ]]; then
                        COMPREPLY=($(compgen -d -- $cur))
                    fi
                    ;;
                filestatus)
                    if [[ $cur == --* ]]; then
                        COMPREPLY=($(compgen -W '--all --list' -- $cur))
                    elif [[ $cur == -* ]]; then
                        COMPREPLY=($(compgen -W '-a -l' -- $cur))
                    else
                        COMPREPLY=($(compgen -f -- $cur))
                    fi
                    ;;
                help)
                    if [[ $cword < 3 ]]; then
                        COMPREPLY=($(compgen -W "${commands}" -- $cur))
                    fi
                    ;;
                ls)
                    COMPREPLY=($(compgen -f -- $cur))
                    ;;
                puburl)
                    if [[ $cword < 3 ]]; then
                        COMPREPLY=($(compgen -f -- $cur))
                    fi
                    ;;
                start)
                    if [[ $cur == --* ]]; then
                        COMPREPLY=($(compgen -W '--install' -- $cur))
                    elif [[ $cur == -* ]]; then
                        COMPREPLY=($(compgen -W '-i' -- $cur))
                    fi
                    ;;
            esac
        fi
    }

    complete -F _dropbox dropbox
}
