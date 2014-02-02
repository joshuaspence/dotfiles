#/
## A shell alias to display the largest files/directories in the current
## directory.
#\

## Display the largest files/directories in the current directory.
alias biggest='ls -Ab | xargs du -hsk | sort -nr'
