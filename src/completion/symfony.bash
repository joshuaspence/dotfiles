include environment/composer.sh

if command -v symfony-autocomplete &>/dev/null; then
  eval "$(symfony-autocomplete)"
fi
