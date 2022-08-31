# TODO: This should only be included when `.personal` is `true` (see twpayne/chezmoi#2310).
if command_exists hass-cli; then
  source <(_HASS_CLI_COMPLETE=bash_source hass-cli completion)
fi
