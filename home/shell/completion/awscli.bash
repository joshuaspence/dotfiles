#/
## {@link http://www.gnu.org/software/bash/ bash} completion for
## {@link http://aws.amazon.com/cli/ awscli}.
##
## @author Joshua Spence
## @file   ~/.shell/completion/awscli.bash
#\

command -v aws &>/dev/null && {
    complete -C aws_completer aws
}
