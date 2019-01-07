if command -v composer &>/dev/null; then
  export PATH="${PATH}:$(composer config --global home)/$(composer config --global bin-dir)"
fi
