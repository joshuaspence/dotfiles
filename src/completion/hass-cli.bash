include environment/virtualenv.sh

if command -v hass-cli &>/dev/null; then
  source <(_HASS_CLI_COMPLETE=bash_source hass-cli completion bash)
fi
