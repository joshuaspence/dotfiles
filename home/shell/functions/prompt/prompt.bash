#/
## A function to echo the {@link http://www.gnu.org/software/bash/ bash} prompt
## statement.
##
## @author Joshua Spence
## @file   ~/.shell/functions/prompt/prompt.bash
#\

command -v shell_prompt__status &>/dev/null || source "${HOME}/.shell/functions/prompt/status.bash"
command -v shell_prompt__user &>/dev/null || source "${HOME}/.shell/functions/prompt/user.bash"
command -v shell_prompt__host &>/dev/null || source "${HOME}/.shell/functions/prompt/host.bash"
command -v shell_prompt__time &>/dev/null || source "${HOME}/.shell/functions/prompt/time.bash"
command -v shell_prompt__pwd &>/dev/null || source "${HOME}/.shell/functions/prompt/pwd.bash"

function shell_prompt() {
    # Some useful unicode sequences.
    local joiner_bottomleft=$(echo -ne '\0342\0224\0224')   # └
    local joiner_topleft=$(echo -ne '\0342\0224\0214')      # ┌
    local separator=$(echo -ne '\0342\0224\0200')           # ─
    local separator_tail=$(echo -ne '\0342\0225\0274')      # ╼

    # The prompt.
    echo -n "${joiner_topleft}${separator}"
    echo -n "[$(shell_prompt__status)]${separator}"
    echo -n "[$(shell_prompt__user)@$(shell_prompt__host)]${separator}"
    echo -n "[$(shell_prompt__time)]"

    echo -n "\n${joiner_bottomleft}${separator}"
    echo -n "[$(shell_prompt__pwd)]"
    echo -n "${separator}${separator_tail} "
}
