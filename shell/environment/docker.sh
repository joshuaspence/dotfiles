# shellcheck shell=sh

if command_exists docker-credential-magic; then
  export DOCKER_ORIG_CONFIG="${HOME}/.config/magic"
fi

if command_exists docker-credential-ecr-login; then
  export AWS_ECR_IGNORE_CREDS_STORAGE=true
fi
