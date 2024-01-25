#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail

# Ensure that `sudo` doesn't create the `~/.sudo_as_admin_successful` file. See sudo-project/sudo#56.
echo 'Defaults !admin_flag' | sudo EDITOR=tee visudo --file /etc/sudoers.d/admin_flag
