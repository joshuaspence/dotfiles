# To print debug messages, run the command: `touch ~/.rcfiles.debug`
[ -e ${HOME}/.rcfiles.debug ] && echo "Parsing ~/.bash_profile..." >&2

# Pull in any system defaults first so they can be overridden later.
# If /etc/profile exists and is readable, then source /etc/profile.
if [ -r /etc/profile ]; then
    [ -e ${HOME}/.rcfiles.debug ] && echo "Sourcing /etc/profile..." >&2
    source /etc/profile
fi

# We run the environment settings for all shells to ensure it's always set up.
if [ -r ${HOME}/.bash/environment ]; then
    [ -e ${HOME}/.rcfiles.debug ] && echo "Sourcing ~/.bash/environment..." >&2
    source ${HOME}/.bash/environment
fi

# An interactive shell starting bash_profile must be a login shell (man bash).
# We run the login script and the interactive setup.
if [ -n ${PS1} ]; then
    if [ -r ${HOME}/.bash/login ]; then
        [ -e ${HOME}/.rcfiles.debug ] && echo "Sourcing ~/.bash/login..." >&2
        source ${HOME}/.bash/login
    fi
    if [ -r ${HOME}/.bash/interactive ]; then
        [ -e ${HOME}/.rcfiles.debug ] && echo "Sourcing ~/.bash/interactive..." >&2
        source ${HOME}/.bash/interactive
    fi
fi

if [ -r ~/.profile ]; then
    [ -e ${HOME}/.rcfiles.debug ] && echo "Sourcing ~/.profile..." >&2
    source ~/.profile
fi

# If running bash...
case $- in
    *i*)
        if [ -f ${HOME}/.bashrc ]; then
            [ -e ${HOME}/.rcfiles.debug ] && echo "Sourcing ~/.bashrc..." >&2
            source ${HOME}/.bashrc
        fi;;
esac

for file in $(find ${HOME} -maxdepth 1 -type f -regextype posic-basic -regex ".*/.\+\.bash_profile"); do
    [ -e ${HOME}/.rcfiles.debug ] && echo "Sourcing ${file}..." >&2
    source ${file}
done



# Add tab completion for SSH hostnames based on ~/.ssh/config, ignoring wildcards
[ -e "$HOME/.ssh/config" ] && complete -o "default" -o "nospace" -W "$(grep "^Host" ~/.ssh/config | grep -v "[?*]" | cut -d " " -f2 | tr ' ' '\n')" scp sftp ssh