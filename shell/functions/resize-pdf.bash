function resize-pdf() {
  if (($# != 2)); then
    echo 'Usage: resize-pdf <input.pdf> <output.pdf>' >&2
    return 1
  fi

  gs -dNOPAUSE -dQUIET -sDEVICE=pdfwrite -sOutputFile="$2" "$1"
}
