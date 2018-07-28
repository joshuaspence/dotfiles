function shell_prompt() {
  local -r cross="${BOLDCOLOR_RED}$(echo -ne '\xE2\x9C\x97')${COLOR_NONE}"
  local -r joiner_bottomleft=$(echo -ne '\0342\0224\0224')
  local -r joiner_topleft=$(echo -ne '\0342\0224\0214')
  local -r separator=$(echo -ne '\0342\0224\0200')
  local -r separator_tail=$(echo -ne '\0342\0225\0274')
  local -r tick="${BOLDCOLOR_GREEN}$(echo -ne '\xE2\x9C\x93')${COLOR_NONE}"

  local -r host="\[${COLOR_CYAN}\]\\H\[${COLOR_NONE}\]"
  local -r pwd="\[${COLOR_GREEN}\]\\w\[${COLOR_NONE}\]"
  local -r status="\[\$([[ \$? != 0 ]] && echo -n '${cross}' || echo -n '${tick}')\]"
  local -r time="\[${COLOR_BLUE}\]\\t\[${COLOR_NONE}\]"
  local -r user="\[${COLOR_YELLOW}\]\\u\[${COLOR_NONE}\]"

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
