#/
## Environment variables defining the operating system type.
##
## @author Joshua Spence
## @file   ~/.shell/environment/os.sh
## @link   http://github.com/mikemcquaid/dotfiles
#\

if [[ $(uname -s) == Darwin ]]; then
    export LINUX='false'
    export OSX='true'
    export UNIX='true'
    export WINDOWS='false'
elif [[ $(uname -s) == Linux ]]; then
    export LINUX='true'
    export OSX='false'
    export UNIX='true'
    export WINDOWS='false'
elif [[ $(uname -s) == *_NT-* ]]; then
    export LINUX='false'
    export OSX='false'
    export UNIX='false'
    export WINDOWS='true'
else
    unset LINUX
    unset OSX
    unset UNIX
    unset WINDOWS
    echo 'Unable to determine operating system' >&2
fi
