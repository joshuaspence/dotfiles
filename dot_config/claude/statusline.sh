#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail

# Claude runs statusLine without a TTY, so COLUMNS is unset; hand the HUD the real width (less a small margin).
cols=$({ stty size </dev/tty | awk '{print $2}'; } 2>/dev/null || true)
: "${cols:=${COLUMNS:-120}}"
export COLUMNS=$((cols > 4 ? cols - 4 : 1))

# claude-hud declares no native statusLine (plugin.json: "statusLine": null), so locate its build ourselves.
# CLAUDE_CODE_PLUGIN_CACHE_DIR (see settings.json) overrides the plugins *root* -- the dir holding cache/, data/
# and marketplaces/ -- despite its name, NOT the cache/ subdir; default it to the in-config-dir location.
plugins_root="${CLAUDE_CODE_PLUGIN_CACHE_DIR:-${CLAUDE_CONFIG_DIR:-${HOME}/.claude}/plugins}"

# Newest installed version, version-sorted. Layout: <root>/cache/<marketplace>/claude-hud/<version>/.
plugin_dir=$(find "${plugins_root}" -maxdepth 4 -type d -path '*/cache/*/claude-hud/*' \
  -name '[0-9]*.[0-9]*.[0-9]*' 2>/dev/null | sort --version-sort | tail -1)

# Degrade to an empty statusline instead of crashing if the plugin isn't installed yet.
[[ -n "${plugin_dir}" ]] || exit 0

exec node "${plugin_dir}/dist/index.js"
