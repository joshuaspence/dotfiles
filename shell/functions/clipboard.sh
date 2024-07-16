# shellcheck shell=sh

clipboard() {
  # If standard input is a pipe then forward the stream to the clipboard.
  if ! test -t 0; then
    xclip -in -selection clipboard </dev/stdin
  fi

  xclip -out -selection clipboard
}
