#===============================================================================
# File: ~/.bash_logout
# Author: Joshua Spence <josh@joshuaspence.com>
#===============================================================================
# Executed by bash(1) when login shell exits.
#-------------------------------------------------------------------------------

# When leaving the console clear the screen to increase privacy.
# First checks that shell level is equal to 1.
if [ "$SHLVL" = 1 ]; then
    # If clear_console exists and is executable, then execute clear_console.
    [ -x /usr/bin/clear_console ] && /usr/bin/clear_console -q
fi
