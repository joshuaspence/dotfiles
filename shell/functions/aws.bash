function aws-sso-refresh-credentials() {
  local -r AWS_CONFIG_FILE="${AWS_CONFIG_FILE:-${HOME}/.aws/config}"
  local -r AWS_SSO_CACHE_DIR="${AWS_SSO_CACHE_DIR:-${HOME}/.aws/sso/cache}"

  grep --perl-regexp --only-matching '(?<=^\[sso-session ).+(?=\]$)' "${AWS_CONFIG_FILE}" | while IFS= read -r SSO_SESSION; do
    SSO_SESSION_ID=$(echo -n "${SSO_SESSION}" | sha1sum | cut --delimiter=' ' --fields=1)

    if (( $(date --date "$(jq --raw-output .expiresAt "${AWS_SSO_CACHE_DIR}/${SSO_SESSION_ID}.json" 2>/dev/null)" +%s) > $(date +%s) )); then
      # SSO credentials are still valid, refresh is not unnecessary.
      continue
    fi

    aws sso login --sso-session "${SSO_SESSION}"
  done
}
