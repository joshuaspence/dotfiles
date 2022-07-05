if command -v batcat &>/dev/null; then
  export MANPAGER="sh -c 'col --no-backspaces --spaces | batcat --plain --language=man'"
fi
