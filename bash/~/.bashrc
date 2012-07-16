#===============================================================================
# File: ~/.bashrc
# Author: Joshua Spence <josh@joshuaspence.com>
#===============================================================================
# Executed by bash(1) for non-login shells. See 
# /usr/share/doc/bash/examples/startup-files (in the package bash-doc).
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

# We run the environment settings for all shells to ensure it's always set up.
source "${HOME}/.bash/environment"

# An interactive shell starting bashrc is not a login shell, just run 
# interactive setup.
if [ -n "${PS1}" ]; then
    source "${HOME}/.bash/interactive"
fi
