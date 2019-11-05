alias ldapsearch='ldapsearch -o ldif-wrap=no -LLL -x -w $(awk '"'"'$1 == "BINDPW" { print $2 }'"'"' ~/.ldaprc)'
