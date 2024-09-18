#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail

dconf load / <<'EOF'
[org/gnome/desktop/datetime]
automatic-timezone = true

[org/gnome/meld]
folder-status-filters = ['normal', 'normal', 'new', 'modified']
highlight-syntax = true
indent-width = 2

[org/gnome/mutter]
experimental-features = ['x11-randr-fractional-scaling']
workspaces-only-on-primary = false

[org/gnome/settings-daemon/plugins/media-keys]
calculator = ['<Primary><Alt>c']
home = ['<Primary><Alt>e']

[org/gnome/settings-daemon/plugins/power]
ambient-enabled = false

[org/gnome/shell]
enabled-extensions = ['tiling-assistant@leleat-on-github', 'tiling-assistant@ubuntu.com', 'ubuntu-dock@ubuntu.com', 'ubuntu-appindicators@ubuntu.com', 'system-monitor@gnome-shell-extensions.gcampax.github.com', 'auto-move-windows@gnome-shell-extensions.gcampax.github.com', 'nightthemeswitcher@romainvigier.fr']
favorite-apps = ['google-chrome.desktop', 'slack_slack.desktop', 'code.desktop', 'org.gnome.Terminal.desktop', 'org.gnome.Nautilus.desktop', 'Zoom.desktop']

[org/gnome/shell/extensions/dash-to-dock]
dock-fixed = false
multi-monitor = true

[org/gnome/shell/extensions/nightthemeswitcher/time]
time-source = 'location'

[org/gnome/system/location]
enabled = true

[org/gnome/terminal/legacy]
new-tab-position = true
new-terminal-mode = 'window'
theme-variant = 'system'

[org/gnome/terminal/legacy/profiles:/:b1dcc9dd-5262-4d8d-a863-c897e6d979b9]
default-size-columns = 275
default-size-rows = 75
palette = ['rgb(46,52,54)', 'rgb(204,0,0)', 'rgb(78,154,6)', 'rgb(196,160,0)', 'rgb(52,101,164)', 'rgb(117,80,123)', 'rgb(6,152,154)', 'rgb(211,215,207)', 'rgb(85,87,83)', 'rgb(239,41,41)', 'rgb(138,226,52)', 'rgb(252,233,79)', 'rgb(114,159,207)', 'rgb(173,127,168)', 'rgb(52,226,226)', 'rgb(238,238,236)']
use-theme-colors = true
use-theme-transparency = true
visible-name = 'Default'

[org/gtk/gtk4/settings/file-chooser]
show-hidden = true
sort-directories-first = true

[org/gtk/settings/file-chooser]
show-hidden = true
EOF
