#/
## Environment variables for {@link http://git-scm.com/ git}.
##
## @author Joshua Spence
## @file   ~/.shell/environment/git.sh
#\

command -v git &>/dev/null && {
    if command -v vim &>/dev/null; then
        export GIT_EDITOR=$(command -v vim)
    elif command -v vi &>/dev/null; then
        export GIT_EDITOR=$(command -v vi)
    else
        unset GIT_EDITOR
        echo 'No command set for GIT_EDITOR environment variable' >&2
    fi
}
