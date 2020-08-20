function ldapsearch() {
  command ldapsearch -o ldif-wrap=no -LLL -x -w "$(awk '$1 == "BINDPW" { print $2 }' ~/.ldaprc | base64 --decode)" "$@"
}

function ldapwhoami() {
  command ldapwhoami -x -w "$(awk '$1 == "BINDPW" { print $2 }' ~/.ldaprc | base64 --decode)" "$@"
}
