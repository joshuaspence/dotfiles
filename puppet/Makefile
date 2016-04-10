# Environment
DIST := $(shell lsb_release --codename --short)
USER := $(shell whoami)

# Commands
PUPPET_BIN_DIR := /opt/puppetlabs/puppet/bin
GEM    := $(PUPPET_BIN_DIR)/gem
PUPPET := $(PUPPET_BIN_DIR)/puppet
R10K   := $(PUPPET_BIN_DIR)/r10k

.PHONY: all
/all: r10k puppet

.PHONY: clean
clean:
	rm --force --recursive ext_modules/

.PHONY: puppet
puppet: ext_modules | $(PUPPET)
	sudo \
	    FACTER_dbus_session_bus_address=$(DBUS_SESSION_BUS_ADDRESS) \
	    FACTER_id=$(USER) \
	    $(PUPPET) apply \
		--basemodulepath=./modules:./ext_modules \
		--hiera_config=./hiera.yaml \
		--strict_variables \
		manifests/site.pp

.PHONY: install
install: $(PUPPET)

.PHONY: r10k
r10k: ext_modules

#===============================================================================

$(PUPPET_BIN_DIR)/%:
	wget --config=/dev/null --no-verbose --output-document=/tmp/puppet.deb https://apt.puppetlabs.com/puppetlabs-release-pc1-$(DIST).deb
	sudo dpkg --install /tmp/puppet.deb
	sudo apt-get update
	sudo apt-get --yes install puppet-agent

$(R10K): | $(GEM)
	sudo $(GEM) install --force --no-rdoc --no-ri r10k

ext_modules: Puppetfile | $(R10K)
	$(R10K) puppetfile install --verbose
	$(R10K) puppetfile purge
