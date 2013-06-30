#/
## Setup default {@link http://www.gnu.org/software/bash/ bash} completion.
##
## @author Joshua Spence
## @file   ~/.shell/completion/completion.bash
#\

if ! shopt -oq posix; then
    if [[ -f /usr/share/bash-completion/bash_completion ]]; then
        source /usr/share/bash-completion/bash_completion
    elif [[ -f /etc/bash_completion ]]; then
        source /etc/bash_completion
    fi
fi
