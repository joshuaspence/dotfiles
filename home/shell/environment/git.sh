#/
## @author Joshua Spence
## @file   ~/.shell/environment/git.sh
#\

## Unset environment variables. #{{{
    unset GIT_EDITOR
    unset GIT_PAGER
    unset GIT_SSH
## #}}}

## Make sure `git` is installed.
command -v git >/dev/null || return

## Source prerequisite environment variables. #{{{
    [[ -n $PAGER ]] || source "${HOME}/.shell/environment/pager.sh"
## #}}}

## Set environment variables. #{{{
    if command -v vim >/dev/null; then
        GIT_EDITOR=$(command -v vim)
    elif command -v vi >/dev/null; then
        GIT_EDITOR=$(command -v vi)
    else
        echo "No command set for GIT_EDITOR environment variable" >&2
    fi

    if [[ -n $PAGER ]]; then
        GIT_PAGER="${PAGER}"
    else
        echo "No command set for GIT_PAGER environment variable" >&2
    fi

    if command -v ssh >/dev/null; then
        GIT_SSH=$(command -v ssh)
    else
        echo "No command set for GIT_SSH environment variable" >&2
    fi
## #}}}

## Export environment variables. #{{{
    export GIT_EDITOR
    export GIT_PAGER
    export GIT_SSH
## #}}}
