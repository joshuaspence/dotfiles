#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail

# Ensure that `sudo` doesn't create the `~/.sudo_as_admin_successful` file. See sudo-project/sudo#56. `sudo-rs` never
# creates it and warns on every run that `admin_flag` is an unknown setting, so it gets no drop-in.
if [[ $(sudo --version) == sudo-rs* ]]; then
  sudo rm --force /etc/sudoers.d/admin_flag
else
  echo 'Defaults !admin_flag' | sudo EDITOR=tee visudo /etc/sudoers.d/admin_flag >/dev/null
fi
