# Unset environment variables.
unset DISABLE_LS_COLORS

# Make sure `ls` is installed.
command -v ls >/dev/null || return

# Set and export environment variables.
export DISABLE_LS_COLORS='false'
