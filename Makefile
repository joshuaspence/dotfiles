#===============================================================================
# Macros
#===============================================================================
DOCKER_RUN  = docker run --rm
MAKE       += --no-print-directory
VIRTUALENV  = $(HOME)/.venv

#===============================================================================
# Target Definitions
#===============================================================================
SUBMODULES    = $(shell git config --file .gitmodules --get-regexp '^submodule\..*\.path$$' | awk '{ print $$2 }')

#===============================================================================
# Functions
#===============================================================================

# Check that a command produces no output to standard error.
# See https://stackoverflow.com/a/25496589.
define check_stderr_empty
! $(1) 2>&1 >/dev/null | grep ^
endef

# The `wildcard` function doesn't recurse into subdirectories.
# See https://stackoverflow.com/a/12959764/1369417.
rwildcard = $(wildcard $1$2) $(foreach dir,$(wildcard $1*),$(call rwildcard,$(dir)/,$2))

# Define a target to install a Python package.
# Should be used in conjunction with `eval`.
define virtualenv_target
.SECONDARY: $(foreach CMD,$(2),$$(VIRTUALENV)/bin/$(CMD))
$(foreach CMD,$(2),$$(VIRTUALENV)/bin/$(CMD)): | $$(VIRTUALENV)
	$(VIRTUALENV)/bin/pip install --constraint home/venv/requirements.txt --quiet $(1)
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
bingo:
	bingo get -moddir home/bingo

.PHONY: dconf
dconf: dconf.ini | $(VIRTUALENV)/bin/gnome-extensions-cli
	cat $< | dconf load /
	$(VIRTUALENV)/bin/gnome-extensions-cli install noannoyance@daase.net

.PHONY: deps
deps:
	sudo apt-get install --no-install-recommends --yes apt-utils ca-certificates curl debian-archive-keyring dpkg-sig gawk git gpg lsb-release make software-properties-common sudo wget

.PHONY: install
install: apt dotfiles virtualenv vundle

.PHONY: dotfiles
dotfiles: home/dotfilesrc | $(VIRTUALENV)/bin/dotfiles
	$(VIRTUALENV)/bin/dotfiles --force --repo $(<D) --config $< --sync

# TODO: Run all `lint-*` targets automatically.
# See https://stackoverflow.com/a/26339924/1369417.
.PHONY: lint
lint: \
	lint-flake8 \
	lint-jsonlint \
	lint-pylint \
	lint-shellcheck \
	lint-yamllint

.PHONY: lint-flake8
lint-flake8: home/pythonrc
	$(DOCKER_RUN) --volume $(CURDIR):$(CURDIR):ro --workdir $(CURDIR) pipelinecomponents/flake8 flake8 $^

# TODO: We should list all of the files to be linted as dependencies of
# the `lint-jsonlint` target, but `make` doesn't properly handle filenames
# containing spaces. See
# https://www.cmcrossroads.com/article/gnu-make-meets-file-names-spaces-them.
# TODO: Is `%q` a valid conversion specification for `printf`?
.PHONY: lint-jsonlint
lint-jsonlint: $(call rwildcard,,*.json)
	$(DOCKER_RUN) --volume $(CURDIR):$(CURDIR):ro --workdir $(CURDIR) tuananhpham/jsonlint jsonlint $(filter-out home/config/Code/User/%,$^)

# TODO: Why do we need `--ignore=pylint`?
.PHONY: lint-pylint
lint-pylint: home/pythonrc
	$(DOCKER_RUN) --volume $(CURDIR):$(CURDIR) --workdir $(CURDIR) cytopia/pylint pylint --ignore=pylint $^

# TODO: Split these into `--shell=sh` and `--shell=bash`.
.PHONY: lint-shellcheck
lint-shellcheck: $(call rwildcard,src,*.*sh) $(call rwildcard,test,*.*sh) $(call rwildcard,test,*.bats) home/bash_logout home/bash_profile home/hushlogin
	$(DOCKER_RUN) --volume $(CURDIR):$(CURDIR):ro --workdir $(CURDIR) koalaman/shellcheck --exclude=SC1090,SC1091 --shell=bash $(filter-out src/modules/%,$^)

# TODO: This should be run from a Docker container.
.PHONY: lint-yamllint
lint-yamllint: $(call rwildcard,,*.yaml) $(call rwildcard,,*.yml) $(call rwildcard,,.*.yaml) $(call rwildcard,,.*.yml) .yamllint | $(VIRTUALENV)/bin/yamllint
	$(VIRTUALENV)/bin/yamllint --strict $(filter-out tools/bats-%,$^)

.PHONY: submodules
submodules: $(SUBMODULES)

# TODO: Run all `test-*` targets automatically.
# See https://stackoverflow.com/a/26339924/1369417.
.PHONY: test
test: \
	test-bootstrap \
	test-curl \
	test-dotfiles \
	test-git \
	test-psql \
	test-python \
	test-ssh \
	test-unit \
	test-vim \
	test-virtualenv \
	test-wget

.PHONY: test-bootstrap
test-bootstrap:
	$(DOCKER_RUN) --volume $(CURDIR):/dotfiles:ro ubuntu bash -e -c '\
		apt-get update --quiet --quiet; \
		apt-get install --no-install-recommends --quiet --quiet --yes git make >/dev/null; \
		git clone --quiet /dotfiles ~/dotfiles; \
		make --directory ~/dotfiles deps all; \
	'

.PHONY: test-curl
test-curl: home/curlrc
	$(call check_stdout_empty,curl --config $< --version)

.PHONY: test-dotfiles
test-dotfiles: home/dotfilesrc | $(VIRTUALENV)/bin/dotfiles
	$(VIRTUALENV)/bin/dotfiles --repo $(<D) --config $< --list >/dev/null

.PHONY: test-git
test-git: home/gitconfig
	$(DOCKER_RUN) --volume $(abspath $<):/gitconfig:ro alpine/git config --file /gitconfig --list >/dev/null

# TODO
.PHONY: test-psql
test-psql: home/psqlrc
	true

.PHONY: test-python
test-python: home/pythonrc
	$(DOCKER_RUN) --volume $(abspath $<):/pythonrc:ro python python /pythonrc

.PHONY: test-ssh
test-ssh: home/ssh/config
	$(DOCKER_RUN) --entrypoint /usr/bin/ssh --volume $(abspath $<):/ssh-config:ro chamunks/alpine-openssh -F /ssh-config -G -T localhost >/dev/null

.PHONY: test-unit
test-unit: $(wildcard tools/bats-*/.git)
	$(DOCKER_RUN) --volume $(CURDIR):$(CURDIR):ro --workdir $(CURDIR) bats/bats --recursive test/

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
	$(DOCKER_RUN) --volume $(abspath $<):/requirements.txt:ro python:3 bash -e -c '\
		apt-get update --quiet --quiet; \
		apt-get install --no-install-recommends --quiet --quiet --yes libcairo2-dev libgirepository1.0-dev; \
		\
		pip install --requirement /requirements.txt --quiet --disable-pip-version-check; \
	'

.PHONY: test-wget
test-wget: home/wgetrc
	$(DOCKER_RUN) --volume $(abspath $<):/wgetrc:ro inutano/wget wget --config /wgetrc --version >/dev/null

.PHONY: update
update: update-asdf update-bingo update-submodules update-virtualenv

.PHONY: update-asdf
update-asdf:
	asdf update
	asdf plugin-update --all

.PHONY: update-bingo
update-bingo:
	echo $(patsubst %.mod,%,$(notdir $(wildcard home/bingo/*.mod))) | xargs --max-args=1 bingo get -moddir home/bingo -u

.PHONY: update-submodules
update-submodules:
	git submodule update --init --recursive --remote

.PHONY: update-virtualenv
update-virtualenv:
	@touch home/venv/requirements.in
	@$(MAKE) home/venv/requirements.txt UPGRADE=1
	@$(MAKE) virtualenv
	pip install --upgrade pip

.PHONY: virtualenv
virtualenv: home/venv/requirements.txt | $(VIRTUALENV)/bin/pip-sync
	$(VIRTUALENV)/bin/pip-sync --quiet --pip-args '--disable-pip-version-check' $<

.PHONY: vscode
vscode: home/vscode/extensions.txt
	cat $< | xargs --max-args=1 code --force --install-extension

.PHONY: vundle
vundle: home/vimrc
	vim \
	  -u NONE \
	  -c 'source home/vimrc' \
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

$(eval $(call virtualenv_target,dotfiles,dotfiles))
$(eval $(call virtualenv_target,flake8,flake8))
$(eval $(call virtualenv_target,pip-tools,pip-compile pip-sync))
$(eval $(call virtualenv_target,pylint,pylint))
$(eval $(call virtualenv_target,yamllint,yamllint))

home/venv/requirements.txt: home/venv/requirements.in | $(VIRTUALENV)/bin/pip-compile
	$(VIRTUALENV)/bin/pip-compile --annotation-style line $(if $(UPGRADE),--upgrade) --output-file $@ --strip-extras --no-emit-index-url $< >/dev/null

home/vscode/extensions.txt:
	code --list-extensions > $@
