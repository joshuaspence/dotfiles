if command_exists determinate-nixd; then
  source <(determinate-nixd completion bash 2>/dev/null)
fi

if command_exists nix; then
  source /nix/var/nix/profiles/default/share/bash-completion/completions/nix
fi
