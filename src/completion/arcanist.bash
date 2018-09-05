if command -v arc &>/dev/null; then
  source "$(readlink --canonicalize-missing "$(command -v arc)/../../resources/shell/bash-completion")"
fi
