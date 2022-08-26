# shellcheck disable=SC2034
{
  XDG_CACHE_HOME="${HOME}/.cache"
  XDG_CONFIG_HOME="${HOME}/.config"
  XDG_DATA_HOME="${HOME}/.local/share"
  XDG_STATE_HOME="${HOME}/.local/state"
  XDG_RUNTIME_DIR="/run/user/$(id --user)"
}

export INPUTRC="${XDG_CONFIG_HOME}/readline/inputrc"
export NODE_REPL_HISTORY="${XDG_DATA_HOME}/node_repl_history"
export VSCODE_EXTENSIONS="${XDG_DATA_HOME}/Code/extensions"
export WGETRC="${XDG_CONFIG_HOME}/wgetrc"

# `~/.tool-versions` cannot be configured (see asdf-vm/asdf#687).
export ASDF_CONFIG_FILE="${XDG_CONFIG_HOME}/asdf/asdfrc"
export ASDF_DATA_DIR="${XDG_DATA_HOME}/asdf"

# `less` gains full support for XDG base directories in version 600 (see gwsw/less#153).
if test "$(less --version | head -n1 | cut -d' ' -f2)" -le 600; then
  export LESSKEYIN="${XDG_CONFIG_HOME}/lesskey"
  export LESSHISTFILE="${XDG_DATA_HOME}/lesshst"
fi
