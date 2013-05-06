#/
## A shell alias to echo the "PATH" variable.
##
## @author Joshua Spence
## @file   ~/.shell/aliases/navigation/path.sh
#\

alias path='echo -e ${PATH//:/\\n}'
