#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail

# Parse JSON input to get query.
QUERY=$(jq --raw-output '.query // ""')

# Change to the project directory.
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 1

rg --files --follow --hidden --files | \
  sort --unique | \
  fzf --filter="${QUERY}" | \
  head --lines=15
