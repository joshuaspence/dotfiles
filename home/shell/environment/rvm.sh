#/
## Setup {@link https://rvm.io/ Ruby Version Manager (RVM)}, if it is available.
##
## @author Joshua Spence
## @file   ~/.shell/environment/rvm.sh
#\

if [[ -f $HOME/.rvm/scripts/rvm ]]; then
    source "${HOME}/.rvm/scripts/rvm"
fi
