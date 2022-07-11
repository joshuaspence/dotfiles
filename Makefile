#===============================================================================
# Macros
#===============================================================================
MAKE       += --no-print-directory
VIRTUALENV  = $(HOME)/.venv

#===============================================================================
# Target Definitions
#===============================================================================
SUBMODULES    = $(shell git config --file .gitmodules --get-regexp '^submodule\..*\.path$$' | awk '{ print $$2 }')

#===============================================================================
# Functions
#===============================================================================

# Define a target to install a Python package.
# Should be used in conjunction with `eval`.
define virtualenv_target
.SECONDARY: $(foreach CMD,$(2),$$(VIRTUALENV)/bin/$(CMD))
$(foreach CMD,$(2),$$(VIRTUALENV)/bin/$(CMD)): | $$(VIRTUALENV)
	$(VIRTUALENV)/bin/pip install --constraint src/venv/requirements.txt --quiet $(1)
endef

#===============================================================================
# Targets
#===============================================================================

.PHONY: all
all: submodules install

.PHONY: apt
apt: aptfile
	sudo tools/bash-aptfile/bin/aptfile $<

.PHONY: bingo
bingo: src/bingo
	bingo get -moddir $<

.PHONY: dconf
dconf: src/dconf/dconf.ini | $(VIRTUALENV)/bin/gnome-extensions-cli
	cat $< | dconf load /
	$(VIRTUALENV)/bin/gnome-extensions-cli install noannoyance@daase.net

.PHONY: deps
deps:
	sudo apt-get install --no-install-recommends --yes apt-utils ca-certificates curl debian-archive-keyring dpkg-sig gawk git gpg lsb-release make software-properties-common sudo wget
	curl --fail --location --no-progress-bar https://chezmoi.io/get | sh -s

.PHONY: install
install: apt dotfiles virtualenv vundle

.PHONY: dotfiles
dotfiles:
	PATH=bin:$$PATH chezmoi apply

.PHONY: submodules
submodules: $(SUBMODULES)

.PHONY: test
test: \
	docker run --rm --volume $(CURDIR):/dotfiles:ro ubuntu:jammy bash -e -c '\
		apt-get update --quiet --quiet; \
		apt-get install --no-install-recommends --quiet --quiet --yes git make sudo >/dev/null; \
		git clone --quiet /dotfiles ~/.local/share/chezmoi; \
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
	echo $(patsubst %.mod,%,$(notdir $(wildcard $</*.mod))) | xargs --max-args=1 bingo get -moddir $< -u

.PHONY: update-submodules
update-submodules:
	git submodule update --init --recursive --remote

.PHONY: update-virtualenv
update-virtualenv:
	@touch src/venv/requirements.in
	@$(MAKE) src/venv/requirements.txt UPGRADE=1
	@$(MAKE) virtualenv
	pip install --upgrade pip

.PHONY: virtualenv
virtualenv: src/venv/requirements.txt | $(VIRTUALENV)/bin/pip-sync
	$(VIRTUALENV)/bin/pip-sync --quiet --pip-args '--disable-pip-version-check' $<

.PHONY: vscode
vscode: src/vscode/extensions.txt
	cat $< | xargs --max-args=1 code --force --install-extension

.PHONY: vundle
vundle: home/dot_vimrc
	vim \
	  -u NONE \
	  -c 'source home/dot_vimrc' \
	  -c PluginInstall -c PluginUpdate -c PluginClean! \
	  -c qall

#===============================================================================
# Rules
#===============================================================================

.SECONDEXPANSION:
 $(SUBMODULES): $$@/.git

$(addsuffix /.git,$(SUBMODULES)): .gitmodules
	git submodule --quiet update --init --recursive -- $(dir $@)
	@touch $@

.SECONDARY: $(VIRTUALENV)
$(VIRTUALENV):
	python3 -m venv $@

$(eval $(call virtualenv_target,pip-tools,pip-compile pip-sync))

src/venv/requirements.txt: src/venv/requirements.in | $(VIRTUALENV)/bin/pip-compile
	$(VIRTUALENV)/bin/pip-compile --annotation-style line $(if $(UPGRADE),--upgrade) --output-file $@ --strip-extras --no-emit-index-url $< >/dev/null

src/vscode/extensions.txt:
	code --list-extensions > $@
