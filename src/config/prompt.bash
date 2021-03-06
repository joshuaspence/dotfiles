PS1=$(
  readonly color_none='\e[0m'
  readonly color_red='\e[0;31m'
  readonly color_green='\e[0;32m'
  readonly color_yellow='\e[0;33m'
  readonly color_blue='\e[0;34m'
  readonly color_cyan='\e[0;36m'
  # shellcheck disable=SC2034
  readonly color_white='\e[0;37m'
  readonly boldcolor_red='\e[1;31m'
  readonly boldcolor_green='\e[1;32m'

  readonly cross='\xE2\x9C\x97'
  readonly joiner_bottomleft=$'\xE2\x94\x94'
  readonly joiner_topleft=$'\xE2\x94\x8C'
  readonly separator=$'\xE2\x94\x80'
  readonly separator_tail=$'\xE2\x95\xBC'
  readonly tick='\xE2\x9C\x93'

  readonly host="\[${color_cyan}\]\[\$([[ -n \$SSH_CONNECTION ]] && printf 'ssh(\H)' || printf 'localhost')\]\[${color_none}\]"
  readonly pwd="\[${color_green}\]\w\[${color_none}\]"
  readonly status="\[\$([[ \$? == 0 ]] && printf '${boldcolor_green}${tick}${color_none}' || printf '${boldcolor_red}${cross}${color_none}')\]"
  readonly time="\[${color_blue}\]\t\[${color_none}\]"
  readonly user="\[\$([[ \$EUID == 0 ]] && printf '${color_red}' || printf '${color_yellow}')\]\u\[${color_none}\]"

  printf \
    "${joiner_topleft}${separator}[%s]${separator}[%s@%s]${separator}%s[%s]\n${joiner_bottomleft}${separator}[%s]${separator}${separator_tail} " \
    "${status}" \
    "${user}" "${host}" \
    "\[\$( [[ \$TERM == screen ]] && printf '[\[${color_yellow}\]%s:%d\[${color_none}\]]${separator}' \"\${TERM}\" \"\${WINDOW}\" )\]" \
    "${time}" \
    "${pwd}"
)
PS2='... > '
PS4='+'

case "${TERM}" in
  xterm*)
    PS1="\[\e]0;\u@\h: \w\a\]${PS1}"
    ;;
  *)
    ;;
esac
