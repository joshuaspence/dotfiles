# shellcheck shell=sh

if command_exists docker-credential-magic; then
  export DOCKER_ORIG_CONFIG="${DOCKER_CONFIG}/magic"
fi
