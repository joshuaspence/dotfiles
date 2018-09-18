include config/colors.sh

PS1=$(
  readonly cross=$'\xE2\x9C\x97'
  readonly joiner_bottomleft=$'\xE2\x94\x94'
  readonly joiner_topleft=$'\xE2\x94\x8C'
  readonly separator=$'\xE2\x94\x80'
  readonly separator_tail=$'\xE2\x95\xBC'
  readonly tick=$'\xE2\x9C\x93'

  readonly host="\[${COLOR_CYAN}\]\[\$([[ -n \$SSH_CONNECTION ]] && printf '\H' || printf 'localhost')\]\[${COLOR_NONE}\]"
  readonly pwd="\[${COLOR_GREEN}\]\w\[${COLOR_NONE}\]"
  readonly status="\[\$([[ \$? == 0 ]] && printf '${BOLDCOLOR_GREEN}${tick}${COLOR_NONE}' || printf '${BOLDCOLOR_RED}${cross}${COLOR_NONE}')\]"
  readonly time="\[${COLOR_BLUE}\]\t\[${COLOR_NONE}\]"
  readonly user="\[\$([[ \$EUID == 0 ]] && printf '${COLOR_RED}' || printf '${COLOR_YELLOW}')\]\u\[${COLOR_NONE}\]"

  echo -n "${joiner_topleft}${separator}"
  echo -n "[${status}]"
  echo -n "${separator}"
  echo -n "[${user}@${host}]"
  echo -n "${separator}"
  echo -n "[${time}]"
  echo -n "\n${joiner_bottomleft}${separator}"
  echo -n "[${pwd}]"
  echo -n "${separator}${separator_tail} "
)

PS2='... > '
PS4='+'

case "${TERM}" in
  xterm*|rxvt*)
    PS1="\[\e]0;\u@\h: \w\a\]${PS1}"
    ;;
  *)
    ;;
esac
