.PHONY: all
all: arc gist git-extras git-sh git-up git-wt-commit hub phpsh rename spark tig vimpager whenever

submake = make --no-print-directory -C $(1) $(2)
sudo-install = sudo install -t /usr/local/bin $(foreach source,$(2),$(1)/$(source))
sudo-submake = sudo $(call submake,$(1),$(2))
todo = echo "$@: TODO"

.PHONY: arc
arc:
	@sudo ln --force --symbolic $$(readlink -f phabricator/arcanist/bin/arc) /usr/local/bin

.PHONY: gist
gist:
	@cd $@ && sudo rake install

.PHONY: git-extras
git-extras:
	@$(call sudo-submake,$@,install)

.PHONY: git-sh
git-sh:
	@$(call sudo-submake,$@,install)

.PHONY: git-up
git-up:
	@$(todo)

.PHONY: git-wt-commit
git-wt-commit:
	$(call sudo-install,$@/bin,git-publish-branch git-rank-contributors git-show-merges git-wt-add git-wtf)

.PHONY: hub
hub:
	@cd hub && rake standalone && sudo rake install

.PHONY: phpsh
phpsh:
	@cd phpsh && python setup.py build && sudo python setup.py install

.PHONY: rename
rename:
	@$(call sudo-install,$@,rename)

.PHONY: spark
spark:
	@$(call sudo-install,$@,spark)

.PHONY: tig
tig:
	@$(call sudo-submake,$@,install prefix=/usr/local)

.PHONY: vimpager
vimpager:
	@$(call sudo-submake,$@,install)

.PHONY: whenever
whenever:
	@cd $@ && rake build && rake install

