#/
## {@link http://www.zsh.org/ zsh} completion for
## {@link http://www.pip-installer.org/ pip}.
#\

command -v pip &>/dev/null && {
    eval "$(pip completion --zsh)"
}
