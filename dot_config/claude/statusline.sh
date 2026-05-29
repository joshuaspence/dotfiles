#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail

cols=$({ stty size </dev/tty | awk '{print $2}'; } 2>/dev/null || true)
: "${cols:=${COLUMNS:-120}}"
export COLUMNS=$((cols > 4 ? cols - 4 : 1))

plugin_dir=$(ls -d "${CLAUDE_CONFIG_DIR:-${HOME}/.claude}"/plugins/cache/*/claude-hud/*/ 2>/dev/null | awk -F/ '{ print $(NF-1) "\t" $0 }' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+[[:space:]]' | sort -t. -k1,1n -k2,2n -k3,3n -k4,4n | tail -1 | cut -f2-)

exec node "${plugin_dir}dist/index.js"
