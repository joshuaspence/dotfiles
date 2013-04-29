#/
## A shell alias to recursively display the largest files/directories in the
## current directory.
##
## @author Joshua Spence
## @file   ~/.shell/aliases/system/rbiggest.sh
#\

alias rbiggest='du -BM -h -x | sort -n -r'
