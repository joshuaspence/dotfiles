#/
## A shell alias to display GPU RAM information.
##
## @author Joshua Spence
## @file   ~/.shell/aliases/system/gpumeminfo.sh
#\

## Display GPU RAM information.
##
## @link http://github.com/desarrolla2/dotfiles/blob/master/aliases.bash
alias gpumeminfo='grep -i --color memory /var/log/Xorg.0.log'
