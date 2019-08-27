if test -d /usr/local/opt/findutils/libexec/gnubin; then
  export PATH="/usr/local/opt/findutils/libexec/gnubin:${PATH}"
fi

if test -d /usr/local/opt/gnu-getopt; then
  export PATH="/usr/local/opt/gnu-getopt/bin:${PATH}"
fi

if test -d /usr/local/opt/python/libexec; then
  export PATH="/usr/local/opt/python/libexec/bin:${PATH}"
fi
