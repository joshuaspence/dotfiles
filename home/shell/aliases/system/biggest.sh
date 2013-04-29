#/
## A shell alias to display the largest files/directories in the current
## directory.
##
## @author Joshua Spence
## @file   ~/.shell/aliases/system/biggest.sh
#\

alias biggest='du -h -s -k $(ls -A) | sort -n -r'
