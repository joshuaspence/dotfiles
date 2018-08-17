.PHONY: test
test: test-composer test-curl test-dotfiles test-ssh test-virtualenv test-wget

.PHONY: test-composer
test-composer:
	docker run --volume $(CURDIR)/home/config/composer:/app composer install --dry-run >/dev/null

.PHONY: test-curl
test-curl:
	! curl --config home/curlrc --version 2>&1 >/dev/null | grep ^

.PHONY: test-dotfiles
test-dotfiles:
	dotfiles --repo home --config home/dotfilesrc --list >/dev/null

.PHONY: test-ssh
test-ssh:
	docker run --entrypoint /usr/bin/ssh --volume $(CURDIR):/dotfiles chamunks/alpine-openssh -F /dotfiles/home/ssh/config -G -T localhost >/dev/null

.PHONY: test-virtualenv
test-virtualenv:
	$(eval VENV := $(shell mktemp --directory))
	@virtualenv --quiet $(VENV)
	bash -c "source $(VENV)/bin/activate && pip install --requirement home/venv/requirements.txt --quiet"
	@rm --recursive --force $(VENV)

.PHONY: test-wget
test-wget:
	wget --config home/wgetrc --version >/dev/null
