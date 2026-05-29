# shellcheck disable=SC2155,SC2164

function git-workspace-clone() {
  local repository="${1?Repository not specified}"
  local destination="${HOME}/workspace/$(sed --regexp-extended 's|\.git$||; s|^([a-z+]+://)?([^@]+@)?([^/:]+)[:/](.+)$|\3/\4|' <<< "${repository}")"

  if test -d "${destination}"; then
    echo "Repository ${repository} has already been cloned to ${destination}" >&2
    return 1
  fi

  git clone "${repository}" "${destination}"
  cd "${destination}"
}
