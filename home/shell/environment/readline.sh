#/
## Environment variable for
## {@link http://cnswww.cns.cwru.edu/php/chet/readline/readline.html readline}.
##
## @author Joshua Spence
## @file   ~/.shell/environment/readline.sh
#\

INPUTRC="${HOME}/.inputrc"
if [[ -f $INPUTRC && -r $INPUTRC ]]; then
    export INPUTRC
else
    unset INPUTRC
    echo 'No file set for INPUTRC environment variable' >&2
fi
