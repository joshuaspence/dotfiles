.PHONY: all
all: git-extras tig

submake = make --no-print-directory -C $(1) $(2)

.PHONY: git-extras
git-extras:
	@sudo $(call submake,$@,install)

.PHONY: tig
tig:
	@$(call submake,$@)
