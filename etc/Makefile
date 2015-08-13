SELF_DIR := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))

apt-sources:
	rm --recursive --force /etc/apt/sources.list.d
	ln --symbolic --force $(SELF_DIR)/apt/sources.list.d /etc/apt/
