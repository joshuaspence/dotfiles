function shell_prompt() {
  local -r cross=$'\xE2\x9C\x97'
  local -r joiner_bottomleft=$'\xE2\x94\x94'
  local -r joiner_topleft=$'\xE2\x94\x8C'
  local -r separator=$'\xE2\x94\x80'
  local -r separator_tail=$'\xE2\x95\xBC'
  local -r tick=$'\xE2\x9C\x93'

  local -r host="\[${COLOR_CYAN}\]\[\$([[ -n \$SSH_CONNECTION ]] && printf '\H' || printf 'localhost')\]\[${COLOR_NONE}\]"
  local -r pwd="\[${COLOR_GREEN}\]\w\[${COLOR_NONE}\]"
  local -r status="\[\$([[ \$? == 0 ]] && printf '${BOLDCOLOR_GREEN}${tick}${COLOR_NONE}' || printf '${BOLDCOLOR_RED}${cross}${COLOR_NONE}')\]"
  local -r time="\[${COLOR_BLUE}\]\t\[${COLOR_NONE}\]"
  local -r user="\[\$([[ \$EUID == 0 ]] && printf '${COLOR_RED}' || printf '${COLOR_YELLOW}')\]\u\[${COLOR_NONE}\]"

  echo -n "${joiner_topleft}${separator}"
  echo -n "[${status}]"
  echo -n "${separator}"
  echo -n "[${user}@${host}]"
  echo -n "${separator}"
  echo -n "[${time}]"
  echo -n "\n${joiner_bottomleft}${separator}"
  echo -n "[${pwd}]"
  echo -n "${separator}${separator_tail} "
}

PS1="$(shell_prompt)"
PS2='... > '
PS4='+'

case "${TERM}" in
  xterm*|rxvt*)
    PS1="\[\e]0;\u@\h: \w\a\]${PS1}"
    ;;
  *)
    ;;
esac
