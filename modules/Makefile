.PHONY: all
all: git-extras hosts hub

submake = make --no-print-directory -C $(1) $(2)
sudo-submake = sudo $(call submake,$(1),$(2))

#===============================================================================
# Git-Extras
#===============================================================================
git-extras_SUBMODULE_DIR := git-extras

clean-git-extras:
	$(call submake,$(git-extras_SUBMODULE_DIR),clean)

.PHONY: install-git-extras
install-git-extras:
	$(call sudo-submake,$(git-extras_SUBMODULE_DIR),install)

uninstall-git-extras:
	$(call sudo-submake,$(git-extras_SUBMODULE_DIR),uninstall)

#===============================================================================
# Hosts
#===============================================================================
hosts_SUBMODULE_DIR := hosts

.PHONY: hosts
hosts: /etc/hosts

clean-hosts


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
