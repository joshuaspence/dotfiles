if command_exists jfrog; then
  source <(JFROG_CLI_AVOID_NEW_VERSION_WARNING=true jfrog completion bash)
fi
