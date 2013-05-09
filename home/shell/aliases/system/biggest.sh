#/
## A shell alias to display the largest files/directories in the current
## directory.
##
## @author Joshua Spence
## @file   ~/.shell/aliases/system/biggest.sh
#\

## Display the largest files/directories in the current directory.
alias biggest='ls -Ab | xargs du -hsk | sort -nr'
