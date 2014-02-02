#/
## A shell alias to recursively display the largest files/directories in the
## current directory.
#\

## Recursively display the largest files/directories in the current directory.
alias rbiggest='du -BM -hx | sort -nr'
