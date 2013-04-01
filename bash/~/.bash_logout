# To print debug messages, run the command: `touch ~/.rcfiles.debug`
function debug() {
    if [ -e ${HOME}/.rcfiles.debug ]; then
        echo $@ >&2
    fi
}

# To print debug messages, run the command: `touch ~/.rcfiles.debug`
debug "Parsing ~/.bash_logout..."

# When leaving the console clear the screen to increase privacy.
# First checks that shell level is equal to 1.
if [ ${SHLVL} = 1 ]; then
    # If clear_console exists and is executable, then execute clear_console.
    [ -x /usr/bin/clear_console ] && /usr/bin/clear_console -q
fi

for file in $(find ${HOME} -maxdepth 1 -type f -regextype posix-extended -regex '.*\.bash_logout' ! -name '.bash_logout'); do
    debug "Sourcing ${file}..."
    source ${file}
done
