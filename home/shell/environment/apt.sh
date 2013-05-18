#/
## Environment variables for {@link http://wiki.debian.org/Apt apt}.
##
## @author Joshua Spence
## @file   ~/.shell/environment/apt.sh
#\

command -v apt-get &>/dev/null && {
    APT_CONFIG="${HOME}/.apt.conf"
    if [[ -f $APT_CONFIG ]]; then
        export APT_CONFIG
    else
        unset APT_CONFIG
        echo 'No file set for APT_CONFIG environment variable' >&2
    fi
}
