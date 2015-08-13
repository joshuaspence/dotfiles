if [[ ! -d $HOME/.venv ]]; then
    virtualenv "${HOME}/.venv"
fi

if [[ -f $HOME/.venv/bin/activate ]]; then
    source "${HOME}/.venv/bin/activate"
fi
