if command -v brew &>/dev/null; then
  HOMEBREW_PREFIX="$(brew --prefix)"

  if [[ -r "${HOMEBREW_PREFIiX}/etc/profile.d/bash_completion.sh" ]]; then
    source "${HOMEBREW_PREFIX}/etc/profile.d/bash_completion.sh"
  else
    for COMPLETION in "${HOMEBREW_PREFIX}/etc/bash_completion.d/"*; do
      source "${COMPLETION}"
    done
  fi
fi

