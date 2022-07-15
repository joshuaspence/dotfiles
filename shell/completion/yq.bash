if command -v yq >/dev/null; then
  source <(yq shell-completion bash)
fi
