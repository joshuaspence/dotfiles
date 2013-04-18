#/
## @author Joshua Spence
## @file   ~/.shell/aliases/system/cpu_hogs.sh
#\

## Display the processes that are using the most processing resources.
##
## @link @todo I am not sure where I got this from...
alias cpu_hogs='ps -e -o %cpu,pid,ppid,user,cmd | awk '\''NR == 1; NR > 1 {print $0 | "sort -nr"}'\'''
