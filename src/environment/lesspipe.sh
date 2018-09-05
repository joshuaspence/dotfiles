if command -v less &>/dev/null; then
  if command -v lesspipe &>/dev/null; then
    eval "$(lesspipe)"
  else
   unset LESSOPEN
   unset LESSCLOSE
   echo 'No command set for $LESSOPEN' >&2
   echo 'No command set for $LESSCLOSE' >&2
  fi
fi
