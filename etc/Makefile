SELF_DIR := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))

apt-sources:
	ln --symbolic --force $(SELF_DIR)/apt/sources.list.d /etc/apt/sources.list.d
