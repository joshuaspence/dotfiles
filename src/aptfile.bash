function apt_keyring() {
  local -r name="$1"
  local -r gpg_key="$2"

  [[ -z $name ]] && log_fail "Please specify a keyring name"
  [[ -z $gpg_key ]] && log_fail "Please specify a GPG key"

  local -r apt_keyring_d="/etc/apt/keyrings"
  local -r apt_keyring="${apt_keyring_d}/${name}.gpg"

  if [[ ! -d $apt_keyring_d ]]; then
    mkdir "${apt_keyring_d}"
  fi

  if [[ -f $apt_keyring ]]; then
    log_info "${APTFILE_CYAN}[OK]${APTFILE_COLOR_OFF} keyring ${name}"
    return
  fi

  if ! { wget --output-document=- "${gpg_key}" | gpg --dearmor --output "${apt_keyring}"; } >"${TMP_APTFILE_LOGFILE}" 2>&1; then
    log_fail "${APTFILE_RED}[FAIL]${APTFILE_COLOR_OFF} keyring ${name}"
  fi

  log_info "${APTFILE_GREEN}[NEW]${APTFILE_COLOR_OFF} keyring ${name}"
}

function apt_repository() {
  local -r name="$1"
  local -r apt_repo="$2"
  local -r components="$3"
  local -r architecture="$4"
  local -r gpg_key="$5"

  [[ -z $name ]] && log_fail "Please specify a repository name"
  [[ -z $apt_repo ]] && log_fail "Please specify a repository source URL"
  [[ -z $components ]] && log_fail "Please specify repository components"

  local apt_opts=()
  [[ -n $architecture ]] && apt_opts+=("arch=${architecture}")

  if [[ -n $gpg_key ]]; then
    apt_keyring "${name}" "${gpg_key}"
    apt_opts+=("signed-by=/etc/apt/keyrings/${name}.gpg")
  fi

  repository_file "${name}" "deb [${apt_opts[*]}] ${apt_repo} ${components}"
}
