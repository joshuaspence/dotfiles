if [[ $(uname) == "Darwin" && ${BASH_VERSINFO[0]} -lt 4 ]]; then
  echo "bash ${BASH_VERSION} detected. Recommend upgrading to a later version." >&2
fi

BREW_PREFIX=$(brew --prefix)

# coreutils
if test -d "${BREW_PREFIX}/opt/coreutils"; then
  export PATH="${BREW_PREFIX}/opt/coreutils/libexec/gnubin:${PATH}"
fi

# findutils
if test -d "${BREW_PREFIX}/opt/findutils"; then
  export PATH="${BREW_PREFIX}/opt/findutils/libexec/gnubin:${PATH}"
fi

# gnu-getopt
if test -d "${BREW_PREFIX}/opt/gnu-getopt"; then
  export PATH="${BREW_PREFIX}/opt/gnu-getopt/bin:${PATH}"
fi

# libpq
if test -d "${BREW_PREFIX}/opt/libpq"; then
  export PATH="${BREW_PREFIX}/opt/libpq/bin:${PATH}"
fi

# python
if test -d "${BREW_PREFIX}/opt/python"; then
  export PATH="${BREW_PREFIX}/opt/python/libexec/bin:${PATH}"
fi
