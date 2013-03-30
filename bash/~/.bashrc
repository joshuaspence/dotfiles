# To print debug messages, run the command: `touch ~/.rcfiles.debug`
[ -e ${HOME}/.rcfiles.debug ] && echo "Parsing ~/.bashrc..." >&2

# We run the environment settings for all shells to ensure it's always set up.
if [ -r ${HOME}/.bash/environment ]; then
    [ -e ${HOME}/.rcfiles.debug ] && echo "Sourcing ~/.bash/environment..." >&2
    source ${HOME}/.bash/environment
fi

# An interactive shell starting bashrc is not a login shell, just run
# interactive setup.
if [ -n ${PS1} ]; then
    [ -e ${HOME}/.rcfiles.debug ] && echo "Sourcing ~/.bash/interactive..." >&2
    source ${HOME}/.bash/interactive
fi

for file in $(find ${HOME} -maxdepth 1 -type f -regextype posic-basic -regex ".*/.\+\.bashrc"); do
    [ -e ${HOME}/.rcfiles.debug ] && echo "Sourcing ${file}..." >&2
    source ${file}
done
