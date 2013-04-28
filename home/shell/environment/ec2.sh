#/
## Set up environment variables for Amazon EC2 CLI tools.
##
## @author Joshua Spence
## @file   ~/.shell/environment/ec2.sh
#\

# Unset environment variables.
unset EC2_HOME
unset EC2_PRIVATE_KEY
unset EC2_CERT

# Make sure Amazon EC2 CLI Tools are installed. To do this, we will just check
# whether `ec2-version` is installed.
command -v ec2-version >/dev/null || return

# Set and export environment variables.
EC2_HOME="${HOME}/.ec2"
if [[ -d $EC2_HOME && -r $EC2_HOME ]]; then
    export EC2_HOME
    export EC2_PRIVATE_KEY=$(ls "${EC2_HOME}/pk-*.pem" 2>/dev/null | head -n 1)
    export EC2_CERT=$(ls "${EC2_HOME}/cert-*.pem" 2>/dev/null | head -n 1)
else
    unset EC2_HOME
    echo 'No command set for EDITOR environment variable' >&2
fi
