#/
## @author Joshua Spence
## @file   ~/.shell/environment/os.sh
##
## @link   http://github.com/mikemcquaid/dotfiles
#\

## Unset environment variables. @{{{
    unset LINUX
    unset OSX
    unset UNIX
    unset WINDOWS
## @}}}

if [[ $(uname -s) == 'Darwin' ]]; then
    OSX=1
    UNIX=1
elif [[ $(uname -s) == 'Linux' ]]; then
    LINUX=1
    UNIX=1
elif [[ $(uname -s) == '*_NT-*' ]]; then
    WINDOWS=1
fi

## Export environment variables. @{{{
    export LINUX
    export OSX
    export UNIX
    export WINDOWS
## @}}}
