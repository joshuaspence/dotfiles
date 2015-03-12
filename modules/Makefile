.PHONY: all
all: git-extras git-sh git-up git-wt-commit rename tig vimpager whenever

submake = make --no-print-directory -C $(1) $(2)
subrake = cd $(1) && bundle install && bundle exec rake $(2)
sudo-install = sudo install -t /usr/local/bin $(foreach source,$(2),$(1)/$(source))
sudo-submake = sudo $(call submake,$(1),$(2))
todo = echo "$@: TODO"

.PHONY: git-extras
git-extras:
	@$(call sudo-submake,$@,install)

.PHONY: git-sh
git-sh:
	@$(call sudo-submake,$@,install)

.PHONY: git-up
git-up:
	@cd git-up && gem build git-up.gemspec && gem install git-up-*.gem

.PHONY: git-wt-commit
git-wt-commit:
	$(call sudo-install,$@/bin,git-publish-branch git-rank-contributors git-show-merges git-wt-add git-wtf)

.PHONY: rename
rename:
	@$(call sudo-install,$@,rename)

.PHONY: tig
tig:
	@$(call submake,$@)

.PHONY: vimpager
vimpager:
	@$(call submake,$@)

.PHONY: whenever
whenever:
	@$(call subrake,$@,install)

