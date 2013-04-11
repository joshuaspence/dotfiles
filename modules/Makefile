.PHONY: all
all: git-extras hosts hub

#===============================================================================
# Git-Extras
#===============================================================================
.PHONY: git-extras
git-extras: install-git-extras

.PHONY: install-git-extras
install-git-extras: update-git-extras
	sudo make -C git-extras install

.PHONY: update-git-extras
update-git-extras:
	cd git-extras && \
	git fetch --all && \
	git reset --hard origin/master

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
	cd $(hub_dir) && sudo rake install
