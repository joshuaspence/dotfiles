#/
## @author Joshua Spence
## @file   ~/.shell/functions/prompt/shell_prompt__user.sh
#\

function shell_prompt__user() {
    if [[ $# > 0 && ( $@ == -c || $@ == --color ) ]]; then
        echo -n -e "\$([[ \${EUID} == 0 ]] && echo '\[${COLOR_RED}\]\u\[${COLOR_NC}\]' || echo '\[${COLOR_YELLOW}\]\u\[${COLOR_NC}\]')"
    else
        echo -n -e "\u"
    fi
}
