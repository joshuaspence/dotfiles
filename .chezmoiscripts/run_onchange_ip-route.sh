#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail

# NetworkManager runs nothing under `/etc/network/if-up.d` without `ifupdown`, so the hook is a dispatcher script.
sudo rm -f /etc/network/if-up.d/ip-route
sudo tee /etc/NetworkManager/dispatcher.d/50-ip-route <<'EOF'
#!/bin/sh

[ "$2" = up ] || exit 0

for SUBNET in 192.168.1.0/24 192.168.10.0/24 192.168.20.0/24 192.168.50.0/24; do
  ip route replace "${SUBNET}" via 192.168.100.1
done
EOF
sudo chmod 755 /etc/NetworkManager/dispatcher.d/50-ip-route
