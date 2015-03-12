.PHONY: all
all: git-extras tig vimpager

submake = make --no-print-directory -C $(1) $(2)

.PHONY: git-extras
git-extras:
	@$(call submake,$@)
	@sudo $(call submake,$@,install)

.PHONY: tig
tig:
	@$(call submake,$@)

.PHONY: vimpager
vimpager:
	@$(call submake,$@)
