#/
## @author Joshua Spence
## @file   ~/.shell/aliases/system/mem_hogs.sh
#\

## Display the processes that are using the most memory.
##
## @link @todo I am not sure where I got this from.
alias mem_hogs='ps -e -o %mem,pid,ppid,user,cmd | awk '\''NR == 1; NR > 1 {print $0 | "sort -nr"}'\'''
