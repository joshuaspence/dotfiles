#/
## A shell alias to display the processes that are using the most memory.
#\

## Display the processes that are using the most memory.
alias mem_hogs='ps -eo %mem,pid,ppid,user,cmd | awk '\''NR == 1; NR > 1 { print $0 | "sort -nr" }'\'''
