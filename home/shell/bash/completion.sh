#/
## Enable programmable completion features in
## {@link http://www.gnu.org/software/bash/ bash}.
##
## @author Joshua Spence
## @file   ~/.shell/bash/completion.sh
#\

if ! shopt -oq posix; then
    if [[ -r /usr/share/bash-completion/bash_completion ]]; then
        source /usr/share/bash-completion/bash_completion
    elif [[ -r /etc/bash_completion ]]; then
        source /etc/bash_completion
    fi
fi
