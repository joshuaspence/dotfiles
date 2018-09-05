include environment/virtualenv.sh

if command -v pip &>/dev/null; then
  eval "$(pip completion --bash)"
fi
