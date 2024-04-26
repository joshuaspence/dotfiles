#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail

sudo tee /etc/network/if-up.d/ip-route <<'EOF'
#!/bin/sh

for SUBNET in 192.168.1.0/24 192.168.10.0/24 192.168.20.0/24 192.168.50.0/24; do
  ip route replace "${SUBNET}" via 192.168.100.1
done
EOF
sudo chmod +x /etc/network/if-up.d/ip-route
