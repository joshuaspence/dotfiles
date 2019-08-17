# Default umask is not applied on WSL. See https://github.com/microsoft/WSL/issues/352.
# NOTE: Apparently this is the best way to detect WSL (see https://github.com/microsoft/WSL/issues/423#issuecomment-221627364).
if [[ "$(< /proc/sys/kernel/osrelease)" == *Microsoft ]]; then
  umask 0022
fi
