XDG_CACHE_HOME="${HOME}/.cache"
XDG_CONFIG_HOME="${HOME}/.config"
XDG_DATA_HOME="${HOME}/.local/share"
XDG_STATE_HOME="${HOME}/.local/state"
XDG_RUNTIME_DIR="/run/user/$(id --user)"

export WGETRC="${XDG_CONFIG_HOME}/wgetrc"
