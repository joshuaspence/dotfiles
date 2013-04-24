#/
## @author Joshua Spence
## @file   ~/.shell/aliases/navigation/two.sh
#\

## Unset alias.
unalias .. 2>/dev/null || true

## Make sure `cd` is installed.
command -v cd >/dev/null || return

## Easier navigation.
##
## @link http://github.com/mathiasbynens/dotfiles/blob/master/.aliases
alias ..='cd ..'
