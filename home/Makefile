.PHONY: init
init: $HOME/.dotfilesrc

$HOME/.dotfilesrc: dotfilesrc
	ln -s $(readlink -f $<) $@
