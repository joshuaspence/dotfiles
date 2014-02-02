#/
## {@link http://www.gnu.org/software/bash/ bash} completion for
## {@link http://www.pip-installer.org/ pip}.
#\

command -v pip &>/dev/null && {
    eval "$(pip completion --bash)"
}
