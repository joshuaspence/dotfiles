#===============================================================================
# Macros
#===============================================================================
COMPOSER   = composer global
DOCKER_RUN = docker run --rm
VIRTUALENV = $(HOME)/.venv

#===============================================================================
# Target Definitions
#===============================================================================
SHELL_TARGETS = home/bashrc home/profile

#===============================================================================
# Functions
#===============================================================================

# Check that a command produces no standard output.
# See https://stackoverflow.com/a/25496589.
define check_stdout_empty
	! $(1) 2>&1 >/dev/null | grep ^
endef

#===============================================================================
# Targets
#===============================================================================

.PHONY: all
all: init-submodules compile install

.PHONY: init-submodules
init-submodules:
	git submodule update --init --recursive

.PHONY: compile
compile: $(SHELL_TARGETS)

.PHONY: install
install: install-dotfiles
ifneq ($(shell command -v composer 2>/dev/null),)
install: install-composer
endif
install: install-virtualenv

.PHONY: install-composer
install-composer: home/config/composer/composer.lock
	$(COMPOSER) install

.PHONY: install-dotfiles
install-dotfiles: home/dotfilesrc | $(VIRTUALENV)/bin/dotfiles
	$(VIRTUALENV)/bin/dotfiles --force --repo $(<D) --config $< --sync

.PHONY: install-virtualenv
install-virtualenv: home/venv/requirements.txt | $(VIRTUALENV)/bin/pip-sync
	$(VIRTUALENV)/bin/pip-sync --quiet $<

.PHONY: lint
lint: shellcheck

# TODO: Remove some of these exclusions.
# TODO: Split these into `--shell=sh` and `--shell=bash`.
.PHONY: shellcheck
shellcheck: $(wildcard src/**/*.*sh) home/bash_logout home/bash_profile
	$(DOCKER_RUN) --volume $(CURDIR):$(CURDIR) --workdir $(CURDIR) koalaman/shellcheck --exclude=SC1090,SC1091,SC2028,SC2046,SC2059,SC2155 --shell=bash $^

.PHONY: test
test: \
	test-bootstrap \
	test-composer \
	test-curl \
	test-dotfiles \
	test-git \
	test-htop \
	test-irb \
	test-python \
	test-readline \
	test-rvm \
	test-ssh \
	test-sublime-text \
	test-terminator \
	test-vim \
	test-virtualenv \
	test-wget

.PHONY: test-bootstrap
test-bootstrap:
	$(DOCKER_RUN) --volume $(CURDIR):/dotfiles:ro ubuntu bash -c '\
		set -o errexit; \
		\
		apt-get update --quiet --quiet; \
		apt-get install --quiet --quiet --no-install-recommends --yes ca-certificates gawk git make python virtualenv >/dev/null; \
		\
		cd ~; \
		git clone /dotfiles; \
		cd dotfiles; \
		make all; \
	'

.PHONY: test-composer
test-composer: home/config/composer/composer.lock
	$(DOCKER_RUN) --volume $(abspath $(<D)):/app composer install --dry-run --quiet

.PHONY: test-curl
test-curl: home/curlrc
	$(call check_stdout_empty,curl --config $< --version)

.PHONY: test-dotfiles
test-dotfiles: home/dotfilesrc | $(VIRTUALENV)
	dotfiles --repo $(<D) --config $< --list >/dev/null

.PHONY: test-git
test-git: home/gitconfig
	true

.PHONY: test-htop
test-htop:
	true

.PHONY: test-irb
test-irb: home/irbrc
	true

.PHONY: test-python
test-python: home/pythonrc
	true

.PHONY: test-readline
test-readline: home/inputrc
	true

.PHONY: test-rvm
test-rvm: home/rvmrc
	true

.PHONY: test-ssh
test-ssh: home/ssh/config
	$(DOCKER_RUN) --entrypoint /usr/bin/ssh --volume $(abspath $<):/root/.ssh/config chamunks/alpine-openssh -F /root/.ssh/config -G -T localhost >/dev/null

.PHONY: test-sublime-text
test-sublime-text:
	true

.PHONY: test-terminator
test-terminator:
	true

.PHONY: test-vim
test-vim: home/vimrc home/vim
	true

.PHONY: test-virtualenv
test-virtualenv: home/venv/requirements.txt
	$(eval VENV := $(shell mktemp --directory --tmpdir venv.XXXXXX))
	@virtualenv --quiet $(VENV)
	. $(VENV)/bin/activate && pip install --requirement $< --isolated --quiet --no-cache-dir
	@rm --recursive --force $(VENV)

.PHONY: test-wget
test-wget: home/wgetrc
	wget --config $< --version >/dev/null

#===============================================================================
# Rules
#===============================================================================

$(VIRTUALENV):
	virtualenv --quiet $@

$(VIRTUALENV)/bin/dotfiles: install-virtualenv

$(VIRTUALENV)/bin/pip-%: | $(VIRTUALENV)
	. $(VIRTUALENV)/bin/activate && pip install --quiet pip-tools

$(VIRTUALENV)/bin/%: install-virtualenv

.SECONDEXPANSION:
$(SHELL_TARGETS): src/$$(@F).*sh $(wildcard src/**/*.*sh)
	gawk --file=tools/compiler/compiler.gawk -- --addpath src --extended --output $@ $<

home/config/composer/composer.lock: home/config/composer/composer.json
	$(COMPOSER) update --quiet

# TODO: All `--upgrade` to be passed to `pip-compile`.
home/venv/requirements.txt: home/venv/requirements.in | $(VIRTUALENV)/bin/pip-compile
	pip-compile --output-file $@ $< >/dev/null
