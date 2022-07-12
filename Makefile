#===============================================================================
# Macros
#===============================================================================
MAKE       += --no-print-directory

#===============================================================================
# Targets
#===============================================================================

.PHONY: all
all: submodules install

.PHONY: deps
deps:
	sudo apt-get install --no-install-recommends --yes apt-utils ca-certificates curl debian-archive-keyring dpkg-sig gawk git gpg lsb-release make software-properties-common sudo wget

.PHONY: install
install: dotfiles

.PHONY: dotfiles
dotfiles:
	chezmoi apply

.PHONY: submodules
submodules: $(SUBMODULES)

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

.PHONY: update
update: update-asdf update-bingo update-submodules update-virtualenv

.PHONY: update-asdf
update-asdf:
	asdf update
	asdf plugin-update --all

.PHONY: update-bingo
update-bingo: src/bingo
	echo $(patsubst %.mod,%,$(notdir $(wildcard $</*.mod))) | tr ' ' '\n' | xargs --replace={} bingo get -moddir $< {}@latest

.PHONY: update-submodules
update-submodules:
	git submodule update --init --recursive --remote

.PHONY: update-virtualenv
update-virtualenv:
	@touch dot_venv/requirements.in
	@$(MAKE) dot_venv/requirements.txt UPGRADE=1

#===============================================================================
# Rules
#===============================================================================

src/venv/requirements.txt: dot_venv/requirements.in
	pip-compile --annotation-style line $(if $(UPGRADE),--upgrade) --output-file $@ --strip-extras --no-emit-index-url $< >/dev/null
