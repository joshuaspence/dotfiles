# Skip this config if we aren't in bash
[ -n "${BASH_VERSION}" ] || return

[ -n "${bashrc_prefix}" ] && export bashrc_prefix

if [ -f "/etc/redhat-release" ] ; then
    LINUX_FLAVOR="$(awk '{print $1}' /etc/redhat-release)"
fi
if [ -f "/etc/lsb-release" ] ; then
    LINUX_FLAVOR="$(head -n 1 /etc/lsb-release | awk -F= '{print $2}')"
fi

#===============================================================================
# System paths
#===============================================================================
# Determines the machine _os to set PATH, MANPATH and _id
_os="$(uname -s)"
case "$_os" in
  Linux)    # Linux
    __push_path PATH /opt/*/current/bin

    __set_grails_home
    __set_groovy_home

    _id=/usr/bin/id
    if [[ -n "${bashrc_local_install}" ]] ; then
      alias super_cmd=""
    else
      alias super_cmd="/usr/bin/sudo -p \"[sudo] password for %u@$(hostname): \""
    fi
    if [ -f "/etc/redhat-release" ] ; then
      LINUX_FLAVOR="$(awk '{print $1}' /etc/redhat-release)"
    fi
    if [ -f "/etc/lsb-release" ] ; then
      LINUX_FLAVOR="$(head -n 1 /etc/lsb-release | awk -F= '{print $2}')"
    fi
  ;;
  Darwin)   # Mac OS X
    __push_path PATH /opt/local/sbin /opt/local/bin /opt/*/current/bin \
      /usr/local/share/python /usr/local/sbin /usr/local/bin
    __push_path MANPATH /opt/local/man /usr/local/share/man

    # if we can determine the version of java as set in java prefs, then export
    # JAVA_HOME to match this
    [[ -s "/usr/libexec/java_home" ]] && export JAVA_HOME=$(/usr/libexec/java_home)

    __set_grails_home
    __set_groovy_home

    _id=/usr/bin/id
    if [[ -n "${bashrc_local_install}" ]] ; then
      alias super_cmd=""
    else
      alias super_cmd="/usr/bin/sudo -p \"[sudo] password for %u@$(hostname): \""
    fi
  ;;
  OpenBSD)  # OpenBSD
    # Set a base PATH based on original /etc/skel/.profile and /root/.profile
    # from 4.6 on 2010-01-01
    __set_path PATH /sbin /sbin /usr/sbin /bin /usr/bin /usr/X11R6/bin \
      /usr/local/sbin /usr/local/bin

    _id=/usr/bin/id
    if [[ -n "${bashrc_local_install}" ]] ; then
      alias super_cmd=""
    else
      alias super_cmd="/usr/bin/sudo -p \"[sudo] password for %u@$(hostname): \""
    fi
  ;;
  SunOS)    # Solaris
    case "$(uname -r)" in
      "5.11") # OpenSolaris
        __set_path PATH /opt/*/current/bin /opt/local/sbin /opt/local/bin \
          /usr/local/sbin /usr/local/bin /usr/gnu/bin \
          /usr/sbin /sbin /usr/bin /usr/X11/bin

        __set_path MANPATH /usr/gnu/share/man /usr/share/man /usr/X11/share/man

        _id=/usr/bin/id
        if [[ -n "${bashrc_local_install}" ]] ; then
          alias super_cmd=""
        else
          alias super_cmd=/usr/bin/pfexec
        fi

        # Files you make look like rw-r--r--
        umask 022

        # Make less the default pager
        export PAGER="/usr/bin/less -ins"
      ;;
      "5.10") # Solaris 10
        # admin path
        __set_path PATH /opt/local/sbin /usr/gnu/sbin /usr/local/sbin \
          /usr/platform/$(uname -i)/sbin /sbin /usr/sbin
        # general path
        __append_path PATH /opt/local/bin /usr/gnu/bin /usr/local/bin \
          /bin /usr/bin /usr/ccs/bin /usr/openwin/bin /usr/dt/bin \
          /opt/sun/bin /opt/SUNWspro/bin /opt/SUNWvts/bin

        __append_path MANPATH /opt/local/share/man /usr/gnu/man \
          /usr/local/man /usr/man /usr/share/man /opt/SUNWspro/man \
          /opt/SUNWvts/man

        _id=/usr/xpg4/bin/id
        if [[ -n "${bashrc_local_install}" ]] ; then
          alias super_cmd=""
        else
          alias super_cmd=/usr/bin/pfexec
        fi

        # build python search path, favoring newer pythons over older ones
        for ver in 2.7 2.6 2.5 2.4 ; do
          __append_path PYTHONPATH /usr/local/lib/python${ver}/site-packages
        done ; unset ver
        [[ -n "$PYTHONPATH" ]] && export PYTHONPATH

        # Files you make look like rw-r--r--
        umask 022

        # Make less the default pager
        if command -v less >/dev/null ; then
          export PAGER="$(command -v less)"
        fi

        unset ADMINPATH
      ;;
    esac
  ;;
  CYGWIN_*) # Windows running Cygwin
    _id=/usr/bin/id
    alias super_cmd=
  ;;
esac # uname -s


# If a $HOME/bin directory exists, add it to the PATH in front
__push_path PATH $HOME/bin

# If a $HOME/man directory exists, add it to the MANPATH in front
__push_path MANPATH $HOME/man

case "$_os" in
  OpenBSD)
    # make sure MANPATH isn't set
    unset MANPATH
  ;;
  *)
    export MANPATH
  ;;
esac # uname -s

export PATH super_cmd

if [[ -r "${bashrc_prefix:-/etc/bash}/bashrc.local" ]] ; then
  source "${bashrc_prefix:-/etc/bash}/bashrc.local"
fi

if [[ -z "$_debug_bashrc" ]] ; then
  unset __set_path __append_path __push_path __remove_from_path
  unset __set_grails_home __set_groovy_home
fi


#==========
##
# Unsets any outstanding environment variables and unsets itself.
#
cleanup() {
  unset PROMPT_COLOR REMOTE_PROMPT_COLOR _os _id bashrc_reload_flag
  unset cleanup
}

# Skip the rest if this is not an interactive shell
if [ -z "${PS1}" -a "$-" != "*i*" ] ; then  cleanup ; return ; fi

#---------------------------------------------------------------
# Interactive shell (prompt,history) settings
#---------------------------------------------------------------

# Set the default editor
if [ -z "$SSH_CLIENT" ] ; then          # for local/console sessions
  case "$TERM" in
  screen*|xterm-256color)               # we're in screen or tmux
    if command -v vim >/dev/null ; then
      export EDITOR="$(which vim)"
      export BUNDLER_EDITOR="$EDITOR"
    else
      export EDITOR="$(which vi)"
      export BUNDLER_EDITOR="$EDITOR"
    fi
  ;;
  *)                                      # we're on a normal term console
    if command -v mvim >/dev/null ; then
      case "$TERM_PROGRAM" in
        Apple_Terminal) _terminal="Terminal"  ;;
        iTerm.app)      _terminal="iTerm"     ;;
      esac
      export EDITOR="$(which mvim) -f -c \"au VimLeave * !open -a ${_terminal}\""
      export BUNDLER_EDITOR="$(which mvim)"
      unset _terminal
    elif command -v gvim >/dev/null ; then
      export EDITOR="$(which gvim) -f"
      export BUNDLER_EDITOR="$(which gvim)"
    elif command -v mate >/dev/null ; then
      export EDITOR="mate -w"
      export EDITOR="mate"
    elif command -v vim >/dev/null ; then
      export EDITOR="$(which vim)"
      export BUNDLER_EDITOR="$EDITOR"
    else
      export EDITOR="$(which vi)"
      export BUNDLER_EDITOR="$EDITOR"
    fi
  ;;
  esac
else                                    # for remote/ssh sessions
  if command -v vim >/dev/null ; then
    export EDITOR="$(which vim)"
  else
    export EDITOR="$(which vi)"
  fi
  export BUNDLER_EDITOR="$EDITOR"
fi
export VISUAL="$EDITOR"
export GEM_EDITOR="$BUNDLER_EDITOR"

# Set default visual tabstop to 2 characters, rather than 8
export EXINIT="set tabstop=2 bg=dark"

# pimp out less with color, assuming source-highlight is installed
if command -v src-hilite-lesspipe.sh >/dev/null ; then
  export LESSOPEN="| $(which src-hilite-lesspipe.sh) %s"
  export LESS=' -R '
fi

# Conditional support for Ruby Version Manager (RVM)
case "$RUBY_MANAGER" in
  chruby)
    safe_source \
      /usr/local/share/chruby/chruby.sh /usr/local/share/chruby/auto.sh
  ;;
  rbenv)
    for d in "${HOME}/.rbenv/bin" "/usr/local/rvm/bin" ; do
      if [ -d "$d" ] ; then
        export PATH="$d:$PATH" ; break
      fi
    done ; unset d
    eval "$(rbenv init -)"
  ;;
  rvm|*)
    safe_source_first "${HOME}/.rvm/scripts/rvm" "/usr/local/lib/rvm"
  ;;
esac

# Number of commands to remember in the command history
export HISTSIZE=10000

# The number of lines contained in the history file
export HISTFILESIZE=999999

# Prepend a timestamp on each history event
export HISTTIMEFORMAT="%Y-%m-%dT%H:%M:%S "

# Ignore commands starting with a space, duplicates,
# and a few others.
export HISTIGNORE="[ ]*:&:bg:fg:ls -l:ls -al:ls -la:ll:la"

bash_prompt ; unset bash_prompt

export IGNOREEOF=10

shopt -s checkwinsize
shopt -s histappend


#---------------------------------------------------------------
# Completions
#---------------------------------------------------------------

if [[ -r "${HOME}/.ssh/known_hosts" ]] ; then
  # ssh hosts from ~/.ssh/known_hosts
  # Thanks to:
  # https://github.com/jqr/dotfiles/blob/master/bash_profile.d/
  _ssh_hosts() {
    grep "Host " "${HOME}/.ssh/config" 2>/dev/null | sed -e "s/Host //g"
    # http://news.ycombinator.com/item?id=751220
    cat "${HOME}/.ssh/known_hosts" | cut -f 1 -d ' ' | \
      sed -e s/,.*//g | uniq | grep -v "\["
  }
  complete -W "$(_ssh_hosts)" ssh
  unset _ssh_hosts
fi

complete -W "check update reload version" bashrc

# load in rvm completions, if rvm is loaded
safe_source "${rvm_path}/scripts/completion"

# load in some choice completions from homebrew if installed
if command -v brew >/dev/null ; then
  safe_source "$(brew --prefix)/Library/Contributions/brew_bash_completion.sh"

  for c in git-completion.bash git-flow-completion.bash ; do
    safe_source "$(brew --prefix)/etc/bash_completion.d/$c"
  done ; unset c
fi

case "$_os" in
  Linux)
    if [ -f "/etc/bash_completion" ] && ! shopt -oq posix; then
      safe_source "/etc/bash_completion"
    fi
  ;;
esac


safe_source "${bashrc_prefix:-/etc/bash}/bashrc.local" "${HOME}/.bash_aliases"

cleanup

#%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
# To print debug messages, run the command: `touch ~/.rcfiles.debug`
function debug() {
    if [ -e ${HOME}/.rcfiles.debug ]; then
        echo $@ >&2
    fi
}

debug "Parsing ~/.bashrc..."

# We run the environment settings for all shells to ensure it's always set up.
if [ -r ${HOME}/.bash/environment ]; then
    debug "Sourcing ~/.bash/environment..."
    source ${HOME}/.bash/environment
fi

# An interactive shell starting bashrc is not a login shell, just run interactive setup.
if [ -n ${PS1} ]; then
    debug "Sourcing ~/.bash/interactive..."
    source ${HOME}/.bash/interactive
fi

for file in $(find ${HOME} -maxdepth 1 -type f -regextype posic-basic -regex ".*/.\+\.bashrc"); do
    debug "Sourcing ${file}..."
    source ${file}
done



# I want all history ever plz
export HISTSIZE=1000000
export HISTFILESIZE=1000000000