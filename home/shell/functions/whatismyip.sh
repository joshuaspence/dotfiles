# Get the public IP address of this machine.
function whatismyip() {
  dig +short myip.opendns.com @resolver1.opendns.com
}
