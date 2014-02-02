#/
## {@link http://www.gnu.org/software/bash/ bash} completion for
## {@link http://aws.amazon.com/cli/ awscli}.
#\

command -v aws &>/dev/null && {
    complete -C aws_completer aws
}
