# See aws/aws-cli#2928.
if command_exists aws; then
  complete -C /snap/aws-cli/current/bin/aws_completer aws
fi
