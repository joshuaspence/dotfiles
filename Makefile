.PHONY: all
all: install

.PHONY: deps
deps:
	sudo apt-get install --no-install-recommends --yes apt-utils ca-certificates curl debian-archive-keyring dpkg-sig gawk git gpg lsb-release make software-properties-common sudo wget

.PHONY: install
install: dotfiles

.PHONY: dotfiles
dotfiles:
	chezmoi apply

.PHONY: test
test:
	docker run --rm --volume $(CURDIR):/dotfiles:ro ubuntu:jammy bash -e -c '\
		apt-get update --quiet --quiet; \
		apt-get install --no-install-recommends --quiet --quiet --yes ca-certificates build-essential curl git make sudo; \
		curl --fail --location --no-progress-meter chezmoi.io/get | sh -s -- -b /usr/local/bin; \
		git clone --quiet /dotfiles ~/.local/share/chezmoi; \
		chezmoi init; \
		make --directory ~/.local/share/chezmoi deps all; \
	'
