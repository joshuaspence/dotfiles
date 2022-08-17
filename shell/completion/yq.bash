if command -v yq >/dev/null; then
  if complete -p yq &>/dev/null; then
    echo "Readline completion has already been setup for \`yq\`". >&2
  fi

  source <(yq shell-completion bash)
fi
