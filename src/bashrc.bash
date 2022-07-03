# If not running interactively, don't do anything.
# See https://unix.stackexchange.com/a/257613.
if [[ $- != *i* ]]; then
  return
fi

includex -regex 'config/.+\.\(sh\|bash\)$'
includex -regex 'completion/.+\.\(sh\|bash\)$'
includex -regex 'functions/.+\.\(sh\|bash\)$'
