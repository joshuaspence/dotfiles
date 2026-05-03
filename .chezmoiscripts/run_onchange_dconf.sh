#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail

dconf load / <<'EOF'
[org/gnome/desktop/calendar]
show-weekdate = false

[org/gnome/desktop/datetime]
automatic-timezone = true

[org/gnome/desktop/interface]
clock-format = '24h'
clock-show-date = true
clock-show-seconds = false
clock-show-weekday = false
show-battery-percentage = true

[org/gnome/desktop/notifications]
show-in-lock-screen = true

[org/gnome/desktop/privacy]
old-files-age = 30
recent-files-max-age = -1
remember-recent-files = true
remove-old-temp-files = true
remove-old-trash-files = true

[org/gnome/meld]
folder-status-filters = ['normal', 'normal', 'new', 'modified']
highlight-syntax = true
indent-width = 2

[org/gnome/mutter]
attach-modal-dialogs = true
center-new-windows = true
dynamic-workspaces = true
experimental-features = ['scale-monitor-framebuffer', 'x11-randr-fractional-scaling']
workspaces-only-on-primary = false

[org/gnome/nautilus/window-state]
maximized = true

[org/gnome/settings-daemon/plugins/media-keys]
calculator = ['<Primary><Alt>c']
home = ['<Primary><Alt>e']
terminal = ['<Primary><Alt>t']

[org/gnome/settings-daemon/plugins/power]
ambient-enabled = false

[org/gnome/shell]
enabled-extensions = ['tiling-assistant@leleat-on-github', 'tiling-assistant@ubuntu.com', 'ubuntu-dock@ubuntu.com', 'ubuntu-appindicators@ubuntu.com', 'system-monitor@gnome-shell-extensions.gcampax.github.com', 'auto-move-windows@gnome-shell-extensions.gcampax.github.com', 'nightthemeswitcher@romainvigier.fr', 'ding@rastersoft.com', 'launch-new-instance@gnome-shell-extensions.gcampax.github.com', 'workspace-indicator@gnome-shell-extensions.gcampax.github.com']
favorite-apps = ['google-chrome.desktop', 'slack_slack.desktop', 'code.desktop', 'org.gnome.Terminal.desktop', 'org.gnome.Nautilus.desktop', 'Zoom.desktop']

[org/gnome/shell/extensions/auto-move-windows]
application-list = ['slack_slack.desktop:1']

[org/gnome/shell/extensions/dash-to-dock]
autohide = false
dock-fixed = false
dock-position = 'LEFT'
extend-height = true
multi-monitor = true
shift-click-action = 'launch'
show-apps-at-top = false
show-favorites = true
show-running = true

[org/gnome/shell/extensions/nightthemeswitcher/time]
manual-schedule = false
time-source = 'location'

[org/gnome/shell/extensions/system-monitor]
show-cpu = true
show-download = true
show-memory = true
show-swap = true
show-upload = true

[org/gnome/shell/extensions/tiling-assistant]
enable-tiling-popup = false
restore-window = ['<Super>Down']
tile-bottom-half = ['<Super>KP_2']
tile-bottomleft-quarter=['<Super>KP_1']
tile-bottomright-quarter=['<Super>KP_3']
tile-left-half = ['<Super>KP_4']
tile-maximize = ['<Super>Up']
tile-right-half = ['<Super>KP_6']
tile-top-half = ['<Super>KP_8']
tile-topleft-quarter = ['<Super>KP_7']
tile-topright-quarter=['<Super>KP_9']
tiling-popup-all-workspace = false

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
clock-format = '24h'
show-hidden = true
EOF
