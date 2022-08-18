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
