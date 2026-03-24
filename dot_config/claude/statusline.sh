#!/bin/bash
# shellcheck disable=SC2155

set -o errexit
set -o nounset
set -o pipefail

readonly INPUT=$(cat)
readonly COST=$(echo "${INPUT}" | jq --raw-output '.cost.total_cost_usd // 0')
readonly DURATION_MS=$(echo "${INPUT}" | jq --raw-output '.cost.total_duration_ms // 0')
readonly MODEL=$(echo "${INPUT}" | jq --raw-output '.model.display_name')
readonly USED_PERCENTAGE=$(echo "${INPUT}" | jq --raw-output '.context_window.used_percentage // 0' | cut --delimiter=. --fields=1)

readonly CYAN='\033[36m'
readonly GREEN='\033[32m'
readonly YELLOW='\033[33m'
readonly RED='\033[31m'
readonly RESET='\033[0m'

# Pick bar color based on context usage.
if [[ ${USED_PERCENTAGE} -ge 90 ]]; then
  BAR_COLOUR="${RED}"
elif [[ ${USED_PERCENTAGE} -ge 70 ]]; then
  BAR_COLOUR="${YELLOW}"
else
  BAR_COLOUR="${GREEN}"
fi

readonly FILLED=$((USED_PERCENTAGE/ 10))
readonly EMPTY=$((10 - FILLED))
printf -v FILL "%${FILLED}s"
printf -v PAD "%${EMPTY}s"

printf \
  "${CYAN}[%s]${RESET} ${BAR_COLOUR}%s${RESET} %d%% | 💰 ${YELLOW}$%.2f${RESET} | ⏱️ %dm %ds" \
  "${MODEL}" \
  "${FILL// /█}${PAD// /░}" \
  "${USED_PERCENTAGE}" \
  "${COST}" \
  $((DURATION_MS / 60000)) $(((DURATION_MS % 60000) / 1000))
