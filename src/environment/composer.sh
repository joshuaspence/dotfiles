if command -v composer &>/dev/null; then
  export PATH="${PATH}:$(composer config --global home)/vendor/bin"
fi
