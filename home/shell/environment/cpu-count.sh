#/
## An environment variable to store the CPU count.
##
## @author Joshua Spence
## @file   ~/.shell/environment/cpu-count.sh
#\

[[ -n $LINUX ]] || source "${HOME}/.shell/environment/os.sh"

if $OSX; then
    export CPUCOUNT=$(sysctl -n hw.ncpu)
elif $LINUX; then
    export CPUCOUNT=$(getconf _NPROCESSORS_ONLN)
else
    export CPUCOUNT='1'
fi
