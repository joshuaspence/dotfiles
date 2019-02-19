#===============================================================================
# Macros
#===============================================================================
COMPOSER    = composer global
DOCKER_RUN  = docker run --rm
MAKE       += --no-print-directory
VIRTUALENV  = $(HOME)/.venv

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

# Define a target to install a Python package.
# Should be used in conjunction with `eval`.
define virtualenv_target
$(foreach CMD,$(2),$$(VIRTUALENV)/bin/$(CMD)): | $$(VIRTUALENV)
	$(VIRTUALENV)/bin/pip install --constraint home/venv/requirements.txt --quiet $(1)
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
#
# TODO: Make Composer a hard dependency.
ifneq ($(shell command -v composer 2>/dev/null),)
install: composer
endif

.PHONY: dotfiles
dotfiles: home/dotfilesrc | $(VIRTUALENV)/bin/dotfiles
	$(VIRTUALENV)/bin/dotfiles --force --repo $(<D) --config $< --sync

# TODO: Run all `lint-*` targets automatically.
# See https://stackoverflow.com/a/26339924/1369417.
.PHONY: lint
lint: lint-shellcheck lint-yamllint

# TODO: Split these into `--shell=sh` and `--shell=bash`.
.PHONY: lint-shellcheck
lint-shellcheck: $(wildcard src/**/*.*sh) home/bash_logout home/bash_profile home/hushlogin home/rvmrc
	$(DOCKER_RUN) --volume $(CURDIR):$(CURDIR):ro --workdir $(CURDIR) koalaman/shellcheck --exclude=SC1090 --shell=bash $^

.PHONY: lint-yamllint
lint-yamllint: .travis.yml .yamllint | $(VIRTUALENV)/bin/yamllint
	$(VIRTUALENV)/bin/yamllint --strict $^

.PHONY: submodules
submodules: $(SUBMODULES)

# TODO: Run all `test-*` targets automatically.
# See https://stackoverflow.com/a/26339924/1369417.
.PHONY: test
test: \
	test-bootstrap \
	test-composer \
	test-curl \
	test-dotfiles \
	test-git \
	test-irb \
	test-python \
	test-ssh \
	test-sublime-text \
	test-vim \
	test-virtualenv \
	test-wget

.PHONY: test-bootstrap
test-bootstrap:
	$(DOCKER_RUN) --volume $(CURDIR):/dotfiles:ro ubuntu bash -e -c '\
		apt-get update --quiet --quiet; \
		apt-get install --no-install-recommends --quiet --quiet --yes ca-certificates gawk git make python virtualenv >/dev/null; \
		\
		git clone --quiet /dotfiles ~/dotfiles; \
		make --directory ~/dotfiles submodules; \
	'

.PHONY: test-composer
test-composer: home/config/composer/composer.json home/config/composer/composer.lock
	$(DOCKER_RUN) $(foreach FILE,$^,--volume $(abspath $(FILE)):/app/$(notdir $(FILE)):ro) composer install --quiet

.PHONY: test-curl
test-curl: home/curlrc
	$(call check_stdout_empty,curl --config $< --version)

.PHONY: test-dotfiles
test-dotfiles: home/dotfilesrc | $(VIRTUALENV)/bin/dotfiles
	$(VIRTUALENV)/bin/dotfiles --repo $(<D) --config $< --list >/dev/null

.PHONY: test-git
test-git: home/gitconfig
	$(DOCKER_RUN) --volume $(abspath $<):/gitconfig:ro alpine/git config --file /gitconfig --list >/dev/null

.PHONY: test-irb
test-irb: home/irbrc
	$(DOCKER_RUN) --volume $(abspath $<):/irbrc:ro instructure/rvm bash -c -l 'ruby -r irb /irbrc'

.PHONY: test-python
test-python: home/pythonrc
	$(DOCKER_RUN) --volume $(abspath $<):/pythonrc:ro python python /pythonrc

.PHONY: test-ssh
test-ssh: home/ssh/config
	$(DOCKER_RUN) --entrypoint /usr/bin/ssh --volume $(abspath $<):/ssh-config:ro chamunks/alpine-openssh -F /ssh-config -G -T localhost >/dev/null

# TODO: Implement this.
.PHONY: test-sublime-text
test-sublime-text:
	true

.PHONY: test-vim
test-vim: home/vimrc home/vim home/vim/bundle $(wildcard home/vim/**/*)
	$(DOCKER_RUN) \
		--tty \
		$(foreach PATH,$< $(sort $(filter-out $(word 3,$^),$(shell find $(word 2,$^) $(word 3,$^) -mindepth 1 -maxdepth 1 -type d))),--volume $(abspath $(PATH)):$(patsubst home/vim%,/root/.vim%,$(PATH)):ro) \
		--volume $(abspath .git/modules):/.git/modules:ro \
		thinca/vim \
		-u NONE \
		-c 'try | source ~/.vimrc | catch | silent execute "!echo" shellescape(v:exception) | cquit | endtry | quit'


.PHONY: test-virtualenv
test-virtualenv: home/venv/requirements.txt
	$(DOCKER_RUN) --volume $(abspath $<):/requirements.txt:ro python:2.7 pip install --requirement /requirements.txt --quiet --disable-pip-version-check

.PHONY: test-wget
test-wget: home/wgetrc
	$(DOCKER_RUN) --volume $(abspath $<):/wgetrc:ro inutano/wget wget --config /wgetrc --version >/dev/null

.PHONY: update
update: update-composer update-submodules update-virtualenv

.PHONY: update-composer
update-composer:
	@touch home/config/composer/composer.json
	@$(MAKE) home/config/composer/composer.lock

.PHONY: update-submodules
update-submodules:
	git submodule update --init --recursive --remote

.PHONY: update-virtualenv
update-virtualenv:
	@touch home/venv/requirements.in
	@$(MAKE) home/venv/requirements.txt UPGRADE=1

.PHONY: upgrade
upgrade: upgrade-composer upgrade-pip

.PHONY: upgrade-composer
upgrade-composer:
	composer self-update --clean-backups --no-interaction

.PHONY: upgrade-pip
upgrade-pip:
	pip install --upgrade pip

.PHONY: virtualenv
virtualenv: home/venv/requirements.txt | $(VIRTUALENV)/bin/pip-sync
	$(VIRTUALENV)/bin/pip-sync --quiet $<

#===============================================================================
# Rules
#===============================================================================

.SECONDEXPANSION:
 $(SUBMODULES): $$@/.git

$(addsuffix /.git,$(SUBMODULES)): .gitmodules
	git submodule --quiet update --init --recursive -- $(dir $@)
	@touch $@

$(VIRTUALENV):
	virtualenv --quiet $@

$(eval $(call virtualenv_target,dotfiles,dotfiles))
$(eval $(call virtualenv_target,pip-tools,pip-compile pip-sync))
$(eval $(call virtualenv_target,yamllint,yamllint))

.SECONDEXPANSION:
$(SHELL_TARGETS): src/$$(@F).*sh $(wildcard src/**/*.*sh) $(filter src/%,$(SUBMODULES)) | tools/compiler
	gawk --file=tools/compiler/compiler.gawk -- --addpath src --no-info --output $@ --extended $<

home/config/composer/composer.lock: home/config/composer/composer.json
	COMPOSER=$(abspath $<) COMPOSER_HOME $(COMPOSER) update --quiet
	@touch $@

home/venv/requirements.txt: home/venv/requirements.in | $(VIRTUALENV)/bin/pip-compile
	pip-compile $(if $(UPGRADE),--upgrade) --output-file $@ $< >/dev/null
