function whatismyipv4() {
  dig -4 -t A myip.opendns.com @resolver1.opendns.com +short
}

function whatismyipv6() {
  dig -6 -t AAAA myip.opendns.com @resolver1.opendns.com +short
}
