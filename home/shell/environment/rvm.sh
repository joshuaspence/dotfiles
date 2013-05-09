#/
## Setup {@link https://rvm.io/ Ruby Version Manager (RVM)}, if it is available.
##
## @author Joshua Spence
## @file   ~/.shell/environment/rvm.sh
#\

RVM_INIT="${HOME}/.rvm/scripts/rvm"
if [[ -f $RVM_INIT && -r $RVM_INIT ]]; then
    source $RVM_INIT
fi
unset RVM_INIT
