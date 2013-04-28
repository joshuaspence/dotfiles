#/
## @author Joshua Spence
## @file   ~/.shell/aliases/system/rbiggest.sh
#\

## Recursively displays the largest files/directories in the current directory.
##
## @link @todo I am not sure where I got this from.
alias rbiggest='du -BM -h -x | sort -n -r'
