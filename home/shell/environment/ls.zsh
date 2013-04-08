# Unset environment variables.
unset DISABLE_LS_COLORS

# Make sure `ls` is installed.
command -v ls >/dev/null || return

# Set environment variables.
export DISABLE_LS_COLORS='false'
