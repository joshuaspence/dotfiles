#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail

dconf load / << 'EOF'
[org/gnome/desktop/datetime]
automatic-timezone = true

[org/gnome/shell/extensions/nightthemeswitcher/time]
time-source = 'location'

[org/gnome/system/location]
enabled = true
EOF
