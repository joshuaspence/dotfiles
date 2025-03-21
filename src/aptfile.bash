function aptfile_fail() {
  log_fail "${APTFILE_RED-}[FAIL]${APTFILE_COLOR_OFF-}" "$@"
}

function aptfile_new() {
  log_info "${APTFILE_GREEN-}[NEW]${APTFILE_COLOR_OFF-}" "$@"
}

function aptfile_ok() {
  log_info "${APTFILE_CYAN-}[OK]${APTFILE_COLOR_OFF-}" "$@"
}

function apt_keyring() {
  local -r name="$1"
  local -r key_url="$2"

  [[ -z ${name} ]] && log_fail "Please specify a keyring name"
  [[ -z ${key_url} ]] && log_fail "Please specify a key URL"

  local -r apt_keyring_d="/etc/apt/keyrings"
  local -r apt_keyring="${apt_keyring_d}/${name}.gpg"

  if [[ ! -d ${apt_keyring_d} ]]; then
    mkdir "${apt_keyring_d}"
  fi

  if [[ -f ${apt_keyring} ]]; then
    aptfile_ok "keyring ${name}"
    return
  fi

  if ! { wget --output-document=- "${key_url}" | gpg --dearmor --output "${apt_keyring}"; } >"${TMP_APTFILE_LOGFILE:-/dev/null}" 2>&1; then
    aptfile_fail "keyring ${name}"
  fi

  aptfile_new "keyring ${name}"
}

function apt_repository() {
  local -r name="$1"
  local -r repo_url="$2"
  local -r components="$3"
  local -r architecture="$4"
  local -r key_url="$5"

  [[ -z ${name} ]] && log_fail "Please specify a repository name"
  [[ -z ${repo_url} ]] && log_fail "Please specify a repository source URL"
  [[ -z ${components} ]] && log_fail "Please specify repository components"

  local apt_opts=()
  [[ -n ${architecture} ]] && apt_opts+=("arch=${architecture}")

  if [[ -n ${key_url} ]]; then
    apt_keyring "${name}" "${key_url}"
    apt_opts+=("signed-by=/etc/apt/keyrings/${name}.gpg")
  fi

  repository_file "${name}" "deb [${apt_opts[*]}] ${repo_url} ${components}"
}
