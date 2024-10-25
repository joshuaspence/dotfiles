if command_exists hass-cli; then
  source <(_HASS_CLI_COMPLETE=bash_source hass-cli completion)
fi
