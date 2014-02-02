#/
## A shell function to echo the TTY device for the
## {@link http://www.gnu.org/software/bash/ bash} prompt statement.
#\

function shell_prompt__tty() {
    $CLICOLOR && echo -n "\[${PROMPT_TTY_COLOR}\]"
                 echo -n '$(tty)'
    $CLICOLOR && echo -n "\[${COLOR_NC}\]"
}
