if test -d "${HOME}/.jenv"; then
  export PATH="${HOME}/.jenv/bin:${PATH}"
  source <(jenv init -)
fi
