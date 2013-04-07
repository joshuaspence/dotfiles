# Enable programmable completion features.
if ! shopt -oq posix; then
    [ -f /etc/bash_completion ] && source /etc/bash_completion
fi
