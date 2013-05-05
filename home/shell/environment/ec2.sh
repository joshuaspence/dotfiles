#/
## Environment variables for
## {@link http://aws.amazon.com/developertools/351 Amazon EC2 CLI tools}.
##
## @author Joshua Spence
## @file   ~/.shell/environment/ec2.sh
#\

command -v ec2-version >/dev/null || return

EC2_HOME="${HOME}/.ec2"
if [[ -d $EC2_HOME && -r $EC2_HOME ]]; then
    export EC2_HOME
    export EC2_PRIVATE_KEY=$(ls "${EC2_HOME}/pk-*.pem" 2>/dev/null | head -n 1)
    export EC2_CERT=$(ls "${EC2_HOME}/cert-*.pem" 2>/dev/null | head -n 1)
else
    unset EC2_HOME
    unset EC2_PRIVATE_KEY
    unset EC2_CERT
    echo 'No path set for EC2_HOME environment variable' >&2
fi
