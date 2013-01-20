# To print debug messages, run the command: `touch ~/.rcfiles.debug`
[ -e ${HOME}/.rcfiles.debug ] && echo "Parsing ~/.bash_logout..." >&2

# When leaving the console clear the screen to increase privacy.
# First checks that shell level is equal to 1.
if [ ${SHLVL} = 1 ]; then
    # If clear_console exists and is executable, then execute clear_console.
    [ -x /usr/bin/clear_console ] && /usr/bin/clear_console -q
fi

for file in $(find ${HOME} -maxdepth 1 -type f -regextype posic-basic -regex ".*/.\+\.bash_logout"); do
    [ -e ${HOME}/.rcfiles.debug ] && echo "Sourcing ${file}..." >&2
    source ${file}
done
