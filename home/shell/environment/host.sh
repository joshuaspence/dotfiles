#/
## Environment variables to store the current host and domain names.
#\

export HOST=$(hostname -s)
export DOMAIN=$(hostname | sed "s/${HOST}.//")
