#/
## @author Joshua Spence
## @file   ~/.shell/functions/prompt/tty.sh
#\

function shell_prompt__tty() {
    $CLICOLOR && echo -n "\[${PROMPT_TTY_COLOR}\]"
                 echo -n '$(tty)'
    $CLICOLOR && echo -n "\[${COLOR_NC}\]"
}
