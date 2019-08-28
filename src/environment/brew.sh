if [[ $(uname) == "Darwin" && ${BASH_VERSINFO[0]} -lt 4 ]]; then
  echo "bash ${BASH_VERSION} detected. Recommend upgrading to a later version." >&2 
fi

# coreutils
if test -d /usr/local/opt/coreutils; then
  export PATH="/usr/local/opt/coreutils/libexec/gnubin:${PATH}"
fi

# findutils
if test -d /usr/local/opt/findutils; then
  export PATH="/usr/local/opt/findutils/libexec/gnubin:${PATH}"
fi

# gnu-getopt
if test -d /usr/local/opt/gnu-getopt; then
  export PATH="/usr/local/opt/gnu-getopt/bin:${PATH}"
fi

if test -d /usr/local/opt/python; then
  export PATH="/usr/local/opt/python/libexec/bin:${PATH}"
fi
