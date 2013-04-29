#/
## A shell alias to recursively display the largest files/directories in the
## current directory.
##
## @author Joshua Spence
## @file   ~/.shell/aliases/system/rbiggest.sh
#\

## Recursively display the largest files/directories in the current directory.
alias rbiggest='du -BM -hx | sort -nr'
