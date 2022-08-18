if __command_exists yq; then
  if __completion_exists yq; then
    echo "Readline completion has already been setup for \`yq\`". >&2
  fi

  source <(yq shell-completion bash)
fi
