if command_exists latticectl; then
  source <(LATTICECTL_IGNORE_KUBECONFIG=true latticectl --completion-script-bash)
fi
