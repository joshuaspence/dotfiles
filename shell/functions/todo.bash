function diff-todo() {
  diff --unified \
    <(git ls-files) \
    <(sed --regexp-extended 's|^- \[[ x]\] `?([^`]+)`?$|\1|' "${1:TODO}")
}
