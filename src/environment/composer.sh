if command -v composer &>/dev/null; then
  # shellcheck disable=SC2155
  export PATH="${PATH}:$(composer config --global home)/$(composer config --global bin-dir)"
fi
