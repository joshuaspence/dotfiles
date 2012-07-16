#===============================================================================
# File: ~/.profile
# Author: Joshua Spence <josh@joshuaspence.com>
#===============================================================================
# Executed by the command interpreter for login shells. This file is not read by
# bash(1), if ~/.bash_profile or ~/.bash_login exists.
#
# See /usr/share/doc/bash/examples/startup-files for examples. The files are 
# located in the bash-doc package.
#-------------------------------------------------------------------------------

# The default umask is set in /etc/profile; for setting the umask.
# For ssh logins, install and configure the libpam-umask package.
umask 022

# If running bash...
if [ -n "$BASH_VERSION" ]; then
    # Include .bashrc if it exists.
    if [ -f "$HOME/.bashrc" ]; then
		source "$HOME/.bashrc"
    fi
fi

# Set PATH so it includes user's private bin if it exists.
if [ -d "$HOME/bin" ]; then
    PATH="$HOME/bin:$PATH"
fi

# Locale.
export LANG=en_AU.utf-8
export LANGUAGE=en_AU:en
export LC_ALL=en_AU.utf-8
export LC_MESSAGES=en_AU.UTF-8
export LC_CTYPE=en_AU.UTF-8
export LC_COLLATE=en_AU.UTF-8
