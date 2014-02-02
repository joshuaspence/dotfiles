#/
## A shell alias to display the processes that are using the most CPU resources.
#\

## Display the processes that are using the most CPU resources.
alias cpu_hogs='ps -eo %cpu,pid,ppid,user,cmd | awk '\''NR == 1; NR > 1 { print $0 | "sort -nr" }'\'''
