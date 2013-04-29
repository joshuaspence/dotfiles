#/
## "LOGNAME" is a synonym for "USER"; set for compatibility with systems that
## use this variable. This should already be set on most systems.
##
## @author Joshua Spence
## @file   ~/.shell/vars/logname.sh
#\

: ${LOGNAME=$(id -un)}
