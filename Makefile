.PHONY: test
test: test-curl test-dotfiles test-ssh test-wget

.PHONY: test-curl
test-curl:
	! curl --config home/curlrc --version 2>&1 >/dev/null | grep ^

.PHONY: test-dotfiles
test-dotfiles:
	dotfiles --repo home --config home/dotfilesrc --list >/dev/null

.PHONY: test-ssh
test-ssh:
	ssh -F home/ssh/config -G localhost >/dev/null

.PHONY: test-virtualenv
test-virtualenv:
	$(eval VENV := $(shell mktemp --directory))
	@virtualenv --quiet $(VENV)
	bash -c "source $(VENV)/bin/activate && pip install --requirement home/venv/requirements.txt --quiet"
	@rm --recursive --force $(VENV)

.PHONY: test-wget
test-wget:
	wget --config home/wgetrc --version >/dev/null
