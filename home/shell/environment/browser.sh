if [[ -n $DISPLAY ]] && command -v google-chrome &>/dev/null; then
  export BROWSER=$(command -v google-chrome)
elif [[ -n $DISPLAY ]] && command -v firefox &>/dev/null; then
  export BROWSER=$(command -v firefox)
elif command -v lynx &>/dev/null; then
  export BROWSER=$(command -v lynx)
else
  unset BROWSER
  echo 'No command set for $BROWSER' >&2
fi
