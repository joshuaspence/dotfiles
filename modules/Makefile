.PHONY: all
all: gist git-extras git-utils hub rename shell-utils spark vimpager

submake = make --no-print-directory -C $(1) $(2)
sudo-submake = sudo $(call submake,$(1),$(2))
sudo-submake-if-no-command = command -v $(1) >/dev/null 2>&1 && echo "$(1) is installed" || $(call sudo-submake,$(2),$(3))
todo = echo "$@: TODO"

.PHONY: gist
gist:
	@$(todo)

.PHONY: git-extras
git-extras:
	@$(call sudo-submake,$@,install)

.PHONY: git-utils
	@$(todo)

.PHONY: hub
hub:
	@cd hub && sudo rake install

.PHONY: rename
rename:
	@$(todo)

.PHONY: shell-utils
shell-utils:
	@$(todo)

.PHONY: spark
spark:
	@$(todo)

.PHONY: vimpager
vimpager:
	@$(call sudo-submake-if-no-command,$@,$@,install)
