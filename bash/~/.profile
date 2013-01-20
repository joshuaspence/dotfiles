# To print debug messages, run the command: `touch ~/.rcfiles.debug`
[ -e ${HOME}/.rcfiles.debug ] && echo "Parsing ~/.profile..." >&2

# The default umask is set in /etc/profile; for setting the umask.
# For ssh logins, install and configure the libpam-umask package.
umask 022

# Set PATH so it includes user's private bin if it exists.
[ -d ${HOME}/bin ] && export PATH="${HOME}/bin:${PATH}"

# Locale
export LANG=en_AU.utf-8
export LANGUAGE=en_AU:en
export LC_ALL=en_AU.utf-8
export LC_MESSAGES=en_AU.UTF-8
export LC_CTYPE=en_AU.UTF-8
export LC_COLLATE=en_AU.UTF-8

for file in $(find ${HOME} -maxdepth 1 -type f -regextype posic-basic -regex ".*/.\+\.profile"); do
    [ -e ${HOME}/.rcfiles.debug ] && echo "Sourcing ${file}..." >&2
    source ${file}
done