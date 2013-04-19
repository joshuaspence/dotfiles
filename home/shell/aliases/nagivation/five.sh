#/
## @author Joshua Spence
## @file   ~/.shell/aliases/navigation/five.sh
#\

## Unset alias.
unalias .....

## Make sure `cd` is installed.
command -v cd >/dev/null || return

## Easier navigation.
##
## @link http://github.com/mathiasbynens/dotfiles/blob/master/.aliases
alias .....='cd ../../../..'
