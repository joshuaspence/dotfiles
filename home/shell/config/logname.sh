#/
## "LOGNAME" is a synonym for "USER"; set for compatibility with systems that
## use this variable. This should already be set on most systems.
#\

: ${LOGNAME=$(id -un)}
