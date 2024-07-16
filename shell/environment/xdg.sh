# shellcheck shell=sh

# shellcheck disable=SC2034
{
  XDG_CACHE_HOME="${HOME}/.cache"
  XDG_CONFIG_HOME="${HOME}/.config"
  XDG_DATA_HOME="${HOME}/.local/share"
  XDG_STATE_HOME="${HOME}/.local/state"
  XDG_RUNTIME_DIR="/run/user/$(id --user)"
}

export AWS_ECR_CACHE_DIR="${XDG_CACHE_HOME}/ecr"
export DOCKER_CONFIG="${XDG_CONFIG_HOME}/docker"
export INPUTRC="${XDG_CONFIG_HOME}/readline/inputrc"
export VSCODE_EXTENSIONS="${XDG_DATA_HOME}/Code/extensions"
export WGETRC="${XDG_CONFIG_HOME}/wgetrc"

# `less` gains full support for XDG base directories in version 600 (see gwsw/less#153).
if test "$(less --version | head -n1 | cut -d' ' -f2)" -le 600; then
  export LESSKEYIN="${XDG_CONFIG_HOME}/lesskey"
  export LESSHISTFILE="${XDG_STATE_HOME}/lesshst"
fi

export BATS_LIB_PATH="${XDG_DATA_HOME}"
