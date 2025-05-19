# shellcheck shell=sh

if command_exists ssh-askpass; then
  export SSH_ASKPASS=ssh-askpass
  export SSH_ASKPASS_REQUIRE=force
else
  # shellcheck disable=SC2016
  echo 'No command set for $SSH_ASKPASS' >&2
fi
