# TODO: This should only be included when `.work` is `true` (see twpayne/chezmoi#2310).
if command_exists atlas; then
  source <(atlas --completion-script-bash)
fi
