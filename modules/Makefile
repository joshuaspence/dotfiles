.PHONY: all
all: git-extras

submake = make --no-print-directory -C $(1) $(2)

.PHONY: git-extras
git-extras:
	@sudo $(call submake,$@,install)
