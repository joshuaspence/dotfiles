#/
## A shell alias to display the processes that are using the most memory.
##
## @author Joshua Spence
## @file   ~/.shell/aliases/system/mem_hogs.sh
#\

alias mem_hogs='ps -e -o %mem,pid,ppid,user,cmd | awk '\''NR == 1; NR > 1 {print $0 | "sort -n -r"}'\'''
