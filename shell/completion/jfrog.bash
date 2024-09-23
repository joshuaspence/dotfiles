if command_exists jfrog; then
  JFROG_CLI_AVOID_NEW_VERSION_WARNING=true source <(jfrog completion bash)
fi
