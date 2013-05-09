#/
## Bash completion for {@link https://rvm.io/ Ruby Version Manager (RVM)}.
##
## @author Joshua Spence
## @file   ~/.shell/completion/rvm.bash
#\

RVM_COMPLETION="${HOME}/.rvm/scripts/completion"
if [[ -f $RVM_COMPLETION && -r $RVM_COMPLETION ]]; then
    source "${RVM_COMPLETION}"
fi
unset RVM_COMPLETION
