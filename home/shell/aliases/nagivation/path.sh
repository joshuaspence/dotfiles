#/
## A shell alias to echo the "PATH" environment variable.
#\

alias path='echo -e ${PATH//:/\\n}'
