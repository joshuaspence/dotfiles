#===============================================================================
# Macros
#===============================================================================
COMPOSER   = composer global
DOCKER_RUN = docker run --rm
VIRTUALENV = $(HOME)/.venv

#===============================================================================
# Target Definitions
#===============================================================================
SHELL_TARGETS = $(addprefix home/,$(basename $(notdir $(wildcard src/*.*sh))))
SUBMODULES    = $(shell git config --file .gitmodules --get-regexp '^submodule\..*\.path$$' | awk '{ print $$2 }')

#===============================================================================
# Functions
#===============================================================================

# Check that a command produces no standard output.
# See https://stackoverflow.com/a/25496589.
define check_stdout_empty
	! $(1) 2>&1 >/dev/null | grep ^
endef

define pip_install
	. $(VIRTUALENV)/bin/activate && pip install --constraint home/venv/requirements.txt --quiet $(1)
endef

#===============================================================================
# Targets
#===============================================================================

.PHONY: all
all: submodules compile install

.PHONY: compile
compile: $(SHELL_TARGETS)

.PHONY: composer
composer: home/config/composer/composer.json home/config/composer/composer.lock
	COMPOSER=$(abspath $<) $(COMPOSER) install --quiet

.PHONY: install
install: dotfiles virtualenv

# Composer is a soft dependency, so don't worry if it's not installed.
ifneq ($(shell command -v composer 2>/dev/null),)
install: composer
endif

.PHONY: dotfiles
dotfiles: home/dotfilesrc | $(VIRTUALENV)/bin/dotfiles
	$(VIRTUALENV)/bin/dotfiles --force --repo $(<D) --config $< --sync

.PHONY: lint
lint: shellcheck

# TODO: Remove some of these exclusions.
# TODO: Split these into `--shell=sh` and `--shell=bash`.
.PHONY: shellcheck
shellcheck: $(wildcard src/**/*.*sh) home/bash_logout home/bash_profile
	$(DOCKER_RUN) --volume $(CURDIR):$(CURDIR):ro --workdir $(CURDIR) koalaman/shellcheck --exclude=SC1090,SC1091,SC2028,SC2046,SC2059,SC2155 --shell=bash $^

.PHONY: submodules
submodules: $(SUBMODULES)

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
	$(DOCKER_RUN) --volume $(abspath $(<D)):/app:ro composer install --dry-run --quiet

.PHONY: test-curl
test-curl: home/curlrc
	$(call check_stdout_empty,curl --config $< --version)

.PHONY: test-dotfiles
test-dotfiles: home/dotfilesrc | $(VIRTUALENV)/bin/dotfiles
	$(VIRTUALENV)/bin/dotfiles --repo $(<D) --config $< --list >/dev/null

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
	$(DOCKER_RUN) --entrypoint /usr/bin/ssh --volume $(abspath $<):/ssh-config:ro chamunks/alpine-openssh -F /ssh-config -G -T localhost >/dev/null

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

.PHONY: virtualenv
virtualenv: home/venv/requirements.txt | $(VIRTUALENV)/bin/pip-sync
	$(VIRTUALENV)/bin/pip-sync --quiet $<

#===============================================================================
# Rules
#===============================================================================

.SECONDEXPANSION:
 $(SUBMODULES): $$@/.git

$(addsuffix /.git,$(SUBMODULES)): .gitmodules
	git submodule update --init --recursive $(dir $@)
	@touch $@

$(VIRTUALENV):
	virtualenv --quiet $@

$(VIRTUALENV)/bin/dotfiles: | $(VIRTUALENV)

$(VIRTUALENV)/bin/pip-%: | $(VIRTUALENV)
	$(call pip_install,pip-tools)

$(VIRTUALENV)/bin/%: virtualenv

.SECONDEXPANSION:
$(SHELL_TARGETS): src/$$(@F).*sh $(wildcard src/**/*.*sh)
	gawk --file=tools/compiler/compiler.gawk -- --addpath src --extended --output $@ $<

home/config/composer/composer.lock: home/config/composer/composer.json
	COMPOSER=$(abspath $<) $(COMPOSER) update --quiet

home/venv/requirements.txt: home/venv/requirements.in | $(VIRTUALENV)/bin/pip-compile
	pip-compile $(if $(UPGRADE),--upgrade) --output-file $@ $< >/dev/null
