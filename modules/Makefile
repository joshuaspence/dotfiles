.PHONY: all
all: gist git-extras git-sh git-up hub phpsh tig vimpager

submake = make --no-print-directory -C $(1) $(2)
sudo-submake = sudo $(call submake,$(1),$(2))
todo = echo "$@: TODO"

.PHONY: gist
gist:
	@cd $@ && rake build && sudo rake install

.PHONY: git-extras
git-extras:
	@$(call sudo-submake,$@,install)

.PHONY: git-sh
git-sh:
	@$(call sudo-submake,$@,install)

.PHONY: git-up
git-up:
	@$(todo)

.PHONY: hub
hub:
	@cd hub && rake standalone && sudo rake install

.PHONY: phpsh
phpsh:
	@cd phpsh && sudo python setup.py build && sudo python setup.py install

.PHONY: tig
tig:
	@cd tig && make all && sudo make install

.PHONY: vimpager
vimpager:
	@$(call sudo-submake,$@,install)
