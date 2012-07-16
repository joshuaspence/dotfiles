#===============================================================================
# File: ~/.bash_profile
# Author: Joshua Spence <josh@joshuaspence.com>
#===============================================================================
# Executed by bash(1) for login shells.
#
# When you login (type username and password) via console, either sitting at the
# machine, or remotely via ssh: .bash_profile is executed to configure your 
# shell before the initial command prompt.
#
# But, if you've already logged into your machine and open a new terminal window
# (xterm) inside Gnome or KDE, then .bashrc is executed before the window 
# command prompt. .bashrc is also run when you start a new bash instance by 
# typing /bin/bash in a terminal.
#-------------------------------------------------------------------------------

# Pull in any system defaults first so they can be overridden later.
# If /etc/profile exists and is readable, then source /etc/profile.
if [ -r /etc/profile ]; then
    source /etc/profile
fi

# We run the environment settings for all shells to ensure it's always set up.
source "${HOME}/.bash/environment"

# An interactive shell starting bash_profile must be a login shell (man bash).
# We run the login script and the interactive setup.
if [ -n "${PS1}" ]; then
    source "${HOME}/.bash/login"
    source "${HOME}/.bash/interactive"
fi
