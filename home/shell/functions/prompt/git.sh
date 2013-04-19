#/
## @author Joshua Spence
## @file   ~/.shell/functions/prompt/git.sh
#\

## Prints out contextual git state for the command prompt.
##
## @link http://github.com/darkhelmet/dotfiles
## @link http://github.com/fnichol/bashrc/blob/master/bashrc
function git_state() {
    if ! git rev-parse >/dev/null 2>&1; then
        return 1
    fi

    local git_status=$(git -c color.status=false status --short --branch 2>/dev/null)

    local bits=
    printf $git_status | egrep -q '^ ?M'      && bits="${bits}\xb1" # modified files
    printf $git_status | egrep -q '^ ?\?'     && bits="${bits}?"    # untracked files
    printf $git_status | egrep -q '^ ?A'      && bits="${bits}\*"   # new/added files
    printf $git_status | egrep -q '^ ?R'      && bits="${bits}>"    # renamed files
    printf $git_status | egrep -q '^ ?D'      && bits="${bits}\xa7" # deleted files
    printf $git_status | egrep -q ' \[ahead ' && bits="${bits}+"    # ahead of origin

    local branch=$(echo $git_status | egrep '^## ' | awk '{print $2}' | sed 's/\.\.\..*$//')
    [ $branch == "Initial commit on master" ] && branch="nobranch"

    local last_commit=$(git log --pretty=format:'%at' -1 2>/dev/null)
    local age="-1"
    if [ -n $last_commit ]; then
        age=$(( $(( $(date +%s)-last_commit )) / 60 )) # zomg nesting
    fi

    # Color
    local age_color=
    if [ $age -lt 0 ]; then
        age_color="cyan"
    elif [ $age -gt 60 ]; then
        age_color="red"
    elif [ $age -gt 30 ]; then
        age_color="yellow"
    else
        age_color="green"
    fi

    # If age is more than 7 days, show in days otherwise minutes.
    if [ $age -gt 10080 ]; then
        age=$(printf "%dd" $(( age / 1440 )))
    else
        age=$(printf "%dm" $age)
    fi

    case $TERM in
        *term | xterm-* | rxvt | screen | screen-* )
            age="$(bput $age_color)$age$(bput rst)"
            bits="$(bput cyan)$bits$(bput rst)"
            ;;
    esac

    if [ $SHELL_COLOR -eq 1 ]; then
        printf "%b" " $(bput magenta)${cvstool}(${age}$(bput magenta)|$(bput rst)${branch}${bits}$(bput magenta))$(bput rst)"
    else
        printf "%b" " $(bput magenta)${cvstool}(${age}$(bput magenta)|$(bput rst)${branch}${bits}$(bput magenta))$(bput rst)"
    fi
    return 0
}
