#/
## @author Joshua Spence
## @file   ~/.shell/aliases/system/biggest.sh
#\

## Displays the largest files/directories in the current directory.
##
## @link @todo I am not sure where I got this from...
alias biggest='du -h -s -k $(ls -A) | sort -n -r'
