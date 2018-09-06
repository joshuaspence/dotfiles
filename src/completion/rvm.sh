include environment/rvm.sh

# shellcheck disable=SC2154
if test -n "${rvm_path}"; then
  source "${rvm_path}/scripts/completion"
fi
