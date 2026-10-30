# shellcheck shell=sh

# Exported unconditionally: both helpers are installed by mise, which is not yet active in the non-interactive login
# shell that sets up the desktop session, and each variable is read only by its own helper.
export DOCKER_ORIG_CONFIG="${XDG_CONFIG_HOME:-${HOME}/.config}/magic"
export AWS_ECR_IGNORE_CREDS_STORAGE=true
