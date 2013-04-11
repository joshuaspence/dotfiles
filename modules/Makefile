.PHONY: all
all: git-extras hosts hub

#===============================================================================
# Git-Extras
#===============================================================================
.PHONY: git-extras
git-extras:
	sudo make --no-print-directory -C $@ install

#===============================================================================
# Hosts
#===============================================================================
.PHONY: hosts
hosts: /etc/hosts

.PHONY: hosts/hosts
hosts/hosts:
	(echo y; echo n) | python hosts/updateHostsFile.py

/etc/hosts: hosts/hosts
	sudo cp $< $@

#===============================================================================
# Hub
#===============================================================================
.PHONY: hub
hub: /usr/local/bin/hub

/usr/local/bin/hub: hub/hub
	cd hub && sudo rake install
