function resize-pdf() {
  gs -dNOPAUSE -dPDFSETTINGS=/default -dQUIET -sDEVICE=pdfwrite -sOutputFile="${2}" "${1}"
}
