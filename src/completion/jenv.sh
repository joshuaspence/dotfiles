include environment/jenv.sh

# shellcheck disable=SC2154
if test -n "${JENV_ROOT}"; then
  source <(jenv init -)
fi
