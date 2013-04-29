#/
## A shell alias to display the largest files/directories in the current
## directory.
##
## @author Joshua Spence
## @file   ~/.shell/aliases/system/biggest.sh
#\

## Display the largest files/directories in the current directory.
alias biggest='du -hsk $(ls -A) | sort -nr'
