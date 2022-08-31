# TODO: This should only be included when `.personal` is `true` (see twpayne/chezmoi#2310).
# TODO: Use the `lastpassRaw` template function (see twpayne/chezmoi#2310).
if command_exists hass-cli && lpass status --quiet; then
  export HASS_SERVER='http://homeassistant.spence.network'
  export HASS_TOKEN="$(lpass show --notes hass-cli)"
fi
