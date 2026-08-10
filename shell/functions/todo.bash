function create-todo() {
  # shellcheck disable=SC2016
  git -c core.quotePath=false ls-files --format='- [ ] `%(path)`'
}

function parse-todo() {
  # shellcheck disable=SC2016
  sed --quiet --regexp-extended 's|^- \[[ xX]\] `?([^`]+)`?$|\1|p' "${1:--}"
}

function diff-todo() {
  local file="$1"

  if test -z "${file}"; then
    for candidate in TODO TODO.md; do
      if test -f "${candidate}"; then
        file="${candidate}"
        break
      fi
    done
  fi

  if test -z "${file}"; then
    echo 'diff-todo: no TODO or TODO.md found' >&2
    return 1
  fi

  diff \
    --old-line-format=$'\033[31m%l\033[m\n' \
    --new-line-format=$'\033[32m%l\033[m\n' \
    --unchanged-line-format='' \
    <(create-todo | parse-todo) \
    <(parse-todo "${file}")
}
