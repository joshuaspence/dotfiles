# shellcheck shell=sh

whatismyipv4() {
  dig -4 @resolver1.opendns.com myip.opendns.com A +short
}

whatismyipv6() {
  dig -6 @resolver1.opendns.com myip.opendns.com AAAA +short
}
