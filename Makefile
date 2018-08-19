.PHONY: install
install: install-dotfiles install-composer install-virtualenv

.PHONY: install-composer
install-composer: install-dotfiles
	composer global install

.PHONY: install-dotfiles
install-dotfiles: home/dotfilesrc
	dotfiles --repo $(<D) --config $< --sync

.PHONY: install-virtualenv
install-virtualenv: home/venv/requirements.txt | $(HOME)/.venv/bin/activate
	. $(HOME)/.venv/bin/activate && pip-sync $<

$(HOME)/.venv/bin/activate:
	virtualenv $(dir $(@D))

home/venv/requirements.txt: home/venv/requirements.in
	pip-compile --output-file $@ $< >/dev/null

.PHONY: test
test: test-composer test-curl test-dotfiles test-ssh test-virtualenv test-wget

.PHONY: test-composer
test-composer: home/config/composer/composer.json home/config/composer/composer.lock
	docker run --volume $(CURDIR)/$(<D):/app composer install --dry-run >/dev/null

.PHONY: test-curl
test-curl: home/curlrc
	! curl --config $< --version 2>&1 >/dev/null | grep ^

.PHONY: test-dotfiles
test-dotfiles: home/dotfilesrc
	dotfiles --repo $(<D) --config $< --list >/dev/null

.PHONY: test-ssh
test-ssh: home/ssh/config
	docker run --entrypoint /usr/bin/ssh --volume $(abspath $<):/root/.ssh/config chamunks/alpine-openssh -F /root/.ssh/config -G -T localhost >/dev/null

.PHONY: test-virtualenv
test-virtualenv: home/venv/requirements.txt
	$(eval VENV := $(shell mktemp --directory --tmpdir venv.XXXXXX))
	virtualenv --quiet $(VENV)
	bash -c "source $(VENV)/bin/activate && pip install --requirement $< --isolated --quiet --no-cache-dir"
	@rm --recursive --force $(VENV)

.PHONY: test-wget
test-wget: home/wgetrc
	wget --config $< --version >/dev/null
