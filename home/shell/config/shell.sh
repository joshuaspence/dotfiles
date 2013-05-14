#/
## "SHELL" stores the name of the shell. This should already be set on most
## systems.
##
## @author Joshua Spence
## @file   ~/.shell/config/shell.sh
#\

: ${SHELL=$(ps -p $$ h | awk '{print $5}')}
