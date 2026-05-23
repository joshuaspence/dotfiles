#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail

cols=$(stty size </dev/tty 2>/dev/null | awk '"'"'{print }'"'"')
export COLUMNS=$(( ${cols:-120} > 4 ? ${cols:-120} - 4 : 1 ))

plugin_dir=$(ls -d "${CLAUDE_CONFIG_DIR:-${HOME}/.claude}"/plugins/cache/*/claude-hud/*/ 2>/dev/null | awk -F/ '"'"'{ print $(NF-1) "\t" $(0) }'"'"' | grep -E '"'"'^[0-9]+\.[0-9]+\.[0-9]+[[:space:]]'"'"' | sort -t. -k1,1n -k2,2n -k3,3n -k4,4n | tail -1 | cut -f2-)

exec node "${plugin_dir}dist/index.js"

