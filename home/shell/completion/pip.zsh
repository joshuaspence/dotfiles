#/
## {@link http://www.zsh.org/ zsh} completion for
## {@link http://www.pip-installer.org/ pip}.
##
## @author Joshua Spence
## @file   ~/.shell/completion/pip.zsh
#\

command -v pip &>/dev/null && {
    eval "$(pip completion --zsh)"
}
