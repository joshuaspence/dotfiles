if test -f ~/.bash-preexec.sh; then
  source ~/.bash-preexec.sh
fi

if command_exists atuin; then
  source <(atuin init bash)

  # Pull in changes from ellie/atuin#445 until a new version is released.
  if [[ $(atuin --version) == 'atuin 0.10.0' ]]; then
    function __atuin_history() {
      tput rmkx
      HISTORY="$(RUST_LOG=error atuin search -i -- "${READLINE_LINE}" 3>&1 1>&2 2>&3)"
      tput smkx

      READLINE_LINE=${HISTORY}
      READLINE_POINT=${#READLINE_LINE}
    }

    bind -x '"\e[A": __atuin_history'
    bind -x '"\eOA": __atuin_history'
  fi
fi
