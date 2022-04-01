if command -v gcloud &>/dev/null; then
  if [[ $(which gcloud) == /snap/bin/gcloud ]]; then
    source /snap/google-cloud-sdk/current/completion.bash.inc
  fi
fi
