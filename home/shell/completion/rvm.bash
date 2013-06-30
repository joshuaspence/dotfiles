#/
## {@link http://www.gnu.org/software/bash/ bash} completion for
## {@link https://rvm.io/ Ruby Version Manager (RVM)}.
##
## @author Joshua Spence
## @file   ~/.shell/completion/rvm.bash
#\

if [[ -f $HOME/.rvm/scripts/completion ]]; then
    source "${HOME}/.rvm/scripts/completion"
fi
