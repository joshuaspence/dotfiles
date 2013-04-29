#/
## A shell alias to display the processes that are using the most processing
## resources.
##
## @author Joshua Spence
## @file   ~/.shell/aliases/system/cpu_hogs.sh
#\

alias cpu_hogs='ps -e -o %cpu,pid,ppid,user,cmd | awk '\''NR == 1; NR > 1 {print $0 | "sort -n -r"}'\'''
