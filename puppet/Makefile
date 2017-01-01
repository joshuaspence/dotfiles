# Environment
DIST := $(shell lsb_release --codename --short)
USER := $(shell whoami)

# Commands
PUPPET_BIN_DIR := /opt/puppetlabs/puppet/bin
GEM    := $(PUPPET_BIN_DIR)/gem
PUPPET := $(PUPPET_BIN_DIR)/puppet
R10K   := $(PUPPET_BIN_DIR)/r10k

.PHONY: all
all: r10k puppet

.PHONY: clean
clean:
	rm --force --recursive ext_modules/

.PHONY: install
install: $(PUPPET)

.PHONY: puppet
puppet: | $(PUPPET)
	sudo \
	    FACTER_dbus_session_bus_address=$(DBUS_SESSION_BUS_ADDRESS) \
	    FACTER_id=$(USER) \
	    $(PUPPET) apply --confdir=. ./manifests/site.pp

.PHONY: r10k
r10k: ext_modules

#===============================================================================

ext_modules: Puppetfile | $(R10K)
	$(R10K) puppetfile install --verbose
	$(R10K) puppetfile purge

#===============================================================================
# Bootstrapping.
#-------------------------------------------------------------------------------
# These targets are used to install Puppet and R10K.
#===============================================================================

$(PUPPET_BIN_DIR)/%:
	wget --no-verbose --config=/dev/null --output-document=/tmp/puppet.deb 'https://apt.puppetlabs.com/puppetlabs-release-pc1-$(DIST).deb'
	sudo dpkg --install /tmp/puppet.deb
	sudo apt-get --quiet update
	sudo DEBIAN_FRONTEND=noninteractive apt-get --quiet --yes install puppet-agent

$(R10K): | $(GEM)
	sudo $(GEM) install --quiet --no-document r10k
