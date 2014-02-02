#/
## "SHELL" stores the name of the shell. This should already be set on most
## systems.
#\

: ${SHELL=$(ps -p $$ h | awk '{print $5}')}
