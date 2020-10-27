include environment/virtualenv.sh

if command -v hass-cli &>/dev/null; then
  source <(hass-cli completion bash)
fi
