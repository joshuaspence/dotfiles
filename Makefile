.PHONY: test
test: test-curl test-dotfiles test-ssh test-wget

.PHONY: test-curl
test-curl:
	! curl --config home/curlrc --version 2>&1 >/dev/null | grep ^

.PHONY: test-dotfiles
test-dotfiles:
	dotfiles --config home/dotfilesrc --list >/dev/null

.PHONY: test-ssh
test-ssh:
	docker run --entrypoint /usr/bin/ssh --volume $(CURDIR):/dotfiles chamunks/alpine-openssh -F /dotfiles/home/ssh/config -G -T localhost >/dev/null

.PHONY: test-wget
test-wget:
	wget --config home/wgetrc --version >/dev/null
