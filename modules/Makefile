.PHONY: all
all: git-extras hosts hub

submake = make --no-print-directory -C $(1) $(2)
sudo-submake = sudo $(call submake,$(1),$(2))
sudo-submake-if-no-command = command -v $(1) >/dev/null 2>&1 && echo "$(1) is installed" || $(call sudo-submake,$(2),$(3))
todo = echo "TODO" && false

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
# Hub
#===============================================================================
.PHONY: hub
hub: /usr/local/bin/hub

/usr/local/bin/hub: hub/hub
	cd hub && sudo rake install

.PHONY: shell-utils
shell-utils:
	@$(call todo)

.PHONY: spark
spark:
	@$(call todo)

.PHONY: vimpager
vimpager:
	@$(call sudo-submake-if-no-command,$@,$@,install)
