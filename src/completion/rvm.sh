include environment/rvm.sh

if test -n "${rvm_path}"; then
  source "${rvm_path}/scripts/completion"
fi
