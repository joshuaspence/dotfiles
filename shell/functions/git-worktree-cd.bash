# List the current repository's worktrees, one NUL-terminated `<path><TAB><branch>` record each.
#
# `--porcelain -z` is the only listing that survives a worktree path containing a newline: it NUL-terminates every
# attribute and separates records with an empty one. The branch arrives as a full ref, and is absent entirely when the
# worktree is detached, so that field is left empty.
function _git_worktree_list() {
  local attribute path branch

  while IFS= read -r -d '' attribute; do
    case "${attribute}" in
      'worktree '*)
        path="${attribute#worktree }"
        branch=''
        ;;
      'branch refs/heads/'*)
        branch="${attribute#branch refs/heads/}"
        ;;
      '')
        printf '%s\t%s\0' "${path}" "${branch}"
        ;;

      # `HEAD`, `detached`, `bare`, `locked` and `prunable` say nothing about where a worktree is or what it is called.
      *)
        ;;
    esac
  done < <(git worktree list --porcelain -z)
}

# Change directory to one of the current repository's worktrees, named by its branch or by its directory name.
#
# With no argument, pick one with `fzf`, falling back to the main worktree -- `cd`'s own no-argument "go home", read for
# a repository. A name has to match exactly, because the completion offers every one of them: tab, don't guess.
function git-worktree-cd() {
  local -r name="${1-}"
  local -a worktrees=()
  local worktree path record=''

  mapfile -d '' -t worktrees < <(_git_worktree_list)

  # An empty listing means `git` failed, and it has already said why on stderr.
  if ((${#worktrees[@]} == 0)); then
    return 1
  fi

  if [[ -z ${name} ]]; then
    if command_exists fzf; then
      record=$(printf '%s\0' "${worktrees[@]}" | fzf --read0) || return
    else
      # `git worktree list` reports the main worktree first.
      record="${worktrees[0]}"
    fi
  else
    for worktree in "${worktrees[@]}"; do
      path="${worktree%%$'\t'*}"

      if [[ ${name} == "${path##*/}" || ${name} == "${worktree#*$'\t'}" ]]; then
        record="${worktree}"
        break
      fi
    done

    if [[ -z ${record} ]]; then
      echo "git-worktree-cd: no worktree named '${name}'" >&2
      return 1
    fi
  fi

  # shellcheck disable=SC2164
  builtin cd -- "${record%%$'\t'*}"
}

# Complete `git-worktree-cd` with every name its worktrees answer to: each one's directory name, plus its branch where
# that differs. Registered from `.local/share/bash-completion/completions/git-worktree-cd.bash`.
function _git_worktree_cd_complete() {
  local -a worktrees=()
  local -A names=()
  local worktree path branch name quoted

  COMPREPLY=()

  if ((COMP_CWORD > 1)); then
    return
  fi

  # Completion fires wherever the cursor is, including outside a repository, where `git`'s complaint is just noise.
  mapfile -d '' -t worktrees < <(_git_worktree_list 2>/dev/null)

  for worktree in "${worktrees[@]}"; do
    path="${worktree%%$'\t'*}"
    branch="${worktree#*$'\t'}"

    names["${path##*/}"]=''
    if [[ -n ${branch} ]]; then
      names["${branch}"]=''
    fi
  done

  # Readline splits what it inserts the way the shell would, so a directory name containing a space has to go back
  # escaped or `git-worktree-cd` is handed it as two arguments.
  for name in "${!names[@]}"; do
    if [[ ${name} == "${2}"* ]]; then
      printf -v quoted '%q' "${name}"
      COMPREPLY+=("${quoted}")
    fi
  done
}

alias gwtcd='git-worktree-cd'
