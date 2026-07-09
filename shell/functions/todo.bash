function diff-todo() {
  diff \
    --old-line-format=$'\033[31m%l\033[m\n' \
    --new-line-format=$'\033[32m%l\033[m\n' \
    --unchanged-line-format='' \
    <(git ls-files) \
    <(sed --regexp-extended 's|^- \[[ x]\] `?([^`]+)`?$|\1|' "${1:-TODO}")
}
