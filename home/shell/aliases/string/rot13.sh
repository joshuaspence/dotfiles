#/
## A shell alias which acts as a ROT13 encoder/decoder.
##
## @author Joshua Spence
## @file   ~/.shell/aliases/string/rot13.sh
#\

## ROT13 encoder/decoder. The input should be piped into this alias.
##
## @link https://github.com/mathiasbynens/dotfiles/blob/master/.aliases
alias rot13='tr a-zA-Z n-za-mN-ZA-M'
