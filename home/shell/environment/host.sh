#/
## Environment variables to store the current host and domain names.
##
## @author Joshua Spence
## @file   ~/.shell/environment/host.sh
#\

export HOST=$(hostname -s)
export DOMAIN=$(hostname | sed -e "s/${HOST}.//")
