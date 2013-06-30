#/
## {@link http://www.gnu.org/software/bash/ bash} completion for
## {@link http://www.pip-installer.org/ pip}.
##
## @author Joshua Spence
## @file   ~/.shell/completion/pip.bash
#\

command -v pip &>/dev/null && {
    eval "$(pip completion --bash)"
}
