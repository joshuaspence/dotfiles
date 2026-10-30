# By absolute path, because `~/.bashrc` also runs in shells whose inherited `PATH` lacks `~/.local/bin`, such as
# `ssh -t host bash`. The functions it defines call mise by absolute path too.
source <("${HOME}/.local/bin/mise" activate bash)
