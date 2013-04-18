shell_prompt__host() {
    if [ $# -gt 0 ] && ([ "$@" == "-c" ] || [ "$@" == "--color" ]); then
        echo -n -e "\[${COLOR_CYAN}\]\H\[${COLOR_NC}\]"
    else
        echo -n -e "\H"
    fi
}
