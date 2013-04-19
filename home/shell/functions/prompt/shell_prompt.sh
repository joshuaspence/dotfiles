#/
## @author Joshua Spence
## @file   ~/.shell/functions/prompt/shell_prompt.sh
#\

function shell_prompt() {
    # Some useful unicode sequences.    
    local joiner_bottomleft='\0342\0224\0224'   # └
    local joiner_topleft='\0342\0224\0214'      # ┌
    local separator='\0342\0224\0200'           # ─
    local separator_tail='\0342\0225\0274'      # ╼

    # The prompt.
    echo -n -e "${joiner_topleft}${separator}"
    echo -n -e "[$(shell_prompt__status -c)]${separator}"
    echo -n -e "[$(shell_prompt__user -c)@$(shell_prompt__host -c)]${separator}"
    echo -n -e "[$(shell_prompt__tty -c)]"

    echo -n -e "\n${joiner_bottomleft}${separator}"
    echo -n -e "[$(shell_prompt__pwd -c)]"
    echo -n -e "${separator}${separator_tail} "
}
