# Set the terminal title.
#
# See http://tldp.org/HOWTO/Xterm-Title-4.html.
function settitle() {
  echo -ne "\e]0;$@\a"
}

