if command -v less >/dev/null; then
  if command -v lesspipe >/dev/null; then
    source <(lesspipe)
  elif command -v lesspipe.sh >/dev/null; then
    source <(lesspipe.sh)
  else
   unset LESSOPEN
   unset LESSCLOSE

   # shellcheck disable=SC2016
   echo 'No command set for $LESSOPEN' >&2

   # shellcheck disable=SC2016
   echo 'No command set for $LESSCLOSE' >&2
  fi
fi
