#/
## Environment variables defining the operating system type.
##
## @author Joshua Spence
## @file   ~/.shell/environment/os.sh
##
## @link   http://github.com/mikemcquaid/dotfiles
#\

if [[ $(uname -s) == 'Darwin' ]]; then
    unset LINUX
    export OSX=1
    export UNIX=1
    unset WINDOWS
elif [[ $(uname -s) == 'Linux' ]]; then
    export LINUX=1
    unset OSX
    export UNIX=1
    unset WINDOWS
elif [[ $(uname -s) == '*_NT-*' ]]; then
    unset LINUX
    unset OSX
    unset UNIX
    export WINDOWS=1
else
    unset LINUX
    unset OSX
    unset UNIX
    unset WINDOWS
    echo 'Unknown operating system' >&2
fi
