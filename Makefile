.PHONY: init-submodules
init-submodules:
	git submodule update --init --recursive

.PHONY: compile
compile: home/bashrc home/profile

home/bashrc: src/bashrc.bash $(wildcard src/**/*.sh) $(wildcard src/**/*.bash)
	gawk --file=tools/compiler/compiler.gawk -- --addpath src --extended --output $@ $<

home/profile: src/profile.sh $(wildcard src/**/*.sh)
	gawk --file=tools/compiler/compiler.gawk -- --addpath src --extended --output $@ $<

.PHONY: install
install: install-dotfiles install-composer install-virtualenv

.PHONY: install-composer
install-composer: home/config/composer/composer.lock | install-dotfiles
	composer global install

.PHONY: install-dotfiles
install-dotfiles: home/dotfilesrc home/bashrc | install-virtualenv
	dotfiles --repo $(<D) --config $< --sync

.PHONY: install-virtualenv
install-virtualenv: home/venv/requirements.txt | $(HOME)/.venv/bin/pip-sync
	. $(HOME)/.venv/bin/activate && pip-sync $<

$(HOME)/.venv:
	virtualenv $@

$(HOME)/.venv/bin/pip-%: | $(HOME)/.venv
	. $(HOME)/.venv/bin/activate && pip install pip-tools

home/venv/requirements.txt: home/venv/requirements.in | $(HOME)/.venv/bin/pip-compile
	$(HOME)/.venv/bin/pip-compile --output-file $@ $< >/dev/null

.PHONY: lint
lint: shellcheck

# TODO: Remove some of these exclusions.
# TODO: Split these into `--shell=sh` and `--shell=bash`.
.PHONY: shellcheck
shellcheck: $(wildcard src/**/*.sh) $(wildcard src/**/*.bash) home/bash_logout home/bash_profile
	docker run --rm --volume $(CURDIR):$(CURDIR) --workdir $(CURDIR) koalaman/shellcheck --exclude=SC1090,SC1091,SC2028,SC2046,SC2059,SC2155 --shell=bash $^

.PHONY: test
test: test-composer test-curl test-dotfiles test-gpg test-ssh test-virtualenv test-wget

.PHONY: test-composer
test-composer: home/config/composer/composer.lock
	docker run --rm --volume $(CURDIR)/$(<D):/app composer install --dry-run >/dev/null

home/config/composer/composer.lock: home/config/composer/composer.json
	composer global update

.PHONY: test-curl
test-curl: home/curlrc
	! curl --config $< --version 2>&1 >/dev/null | grep ^

.PHONY: test-dotfiles
test-dotfiles: home/dotfilesrc | $(HOME)/.venv
	dotfiles --repo $(<D) --config $< --list >/dev/null

.PHONY: test-gpg
test-gpg: home/gnupg/gpg.conf
	docker run --rm --volume $(abspath $<):/gnupg/gpg.conf stevenctimm/gpgridvanilla gpg --homedir /gnupg --no-permission-warning --list-config

.PHONY: test-ssh
test-ssh: home/ssh/config
	docker run --entrypoint /usr/bin/ssh --rm --volume $(abspath $<):/root/.ssh/config chamunks/alpine-openssh -F /root/.ssh/config -G -T localhost >/dev/null

.PHONY: test-virtualenv
test-virtualenv: home/venv/requirements.txt
	$(eval VENV := $(shell mktemp --directory --tmpdir venv.XXXXXX))
	virtualenv --quiet $(VENV)
	bash -c "source $(VENV)/bin/activate && pip install --requirement $< --isolated --quiet --no-cache-dir"
	@rm --recursive --force $(VENV)

.PHONY: test-wget
test-wget: home/wgetrc
	wget --config $< --version >/dev/null
