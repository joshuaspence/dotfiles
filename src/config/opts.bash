shopt -s cdspell
shopt -s checkhash
shopt -s checkwinsize
shopt -s extglob
shopt -s histreedit
shopt -s histverify

# These options are only supported on Bash 4.
if [[ ${BASH_VERSINFO[0]} -ge 4 ]]; then
  shopt -s dirspell
  shopt -s globstar
fi
