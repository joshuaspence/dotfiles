#/
## Environment variables for {@link http://git-scm.com/ git}.
##
## @author Joshua Spence
## @file   ~/.shell/environment/git.sh
#\

# Make sure `git` is installed.
command -v git >/dev/null || return

# Set "GIT_EDITOR" environment variable.
if command -v vim >/dev/null; then
    export GIT_EDITOR=$(command -v vim)
elif command -v vi >/dev/null; then
    export GIT_EDITOR=$(command -v vi)
else
	unset GIT_EDITOR
    echo 'No command set for GIT_EDITOR environment variable' >&2
fi

# Set "GIT_PAGER" environment variable.
[[ -n $PAGER ]] || source "${HOME}/.shell/environment/pager.sh"
if [[ -n $PAGER ]]; then
    export GIT_PAGER="${PAGER}"
else
	unset GIT_PAGER
    echo 'No command set for GIT_PAGER environment variable' >&2
fi

# Set "GIT_SSH" environment variable.
if command -v ssh >/dev/null; then
    export GIT_SSH=$(command -v ssh)
else
	unset GIT_SSH
    echo 'No command set for GIT_SSH environment variable' >&2
fi
