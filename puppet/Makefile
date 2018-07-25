# Configuration
DIST := $(shell lsb_release --codename --short)
USER := $(shell whoami)

# Commands
PUPPET_BIN_DIR := /opt/puppetlabs/puppet/bin
GEM := $(PUPPET_BIN_DIR)/gem
PUPPET := $(PUPPET_BIN_DIR)/puppet
LIBRARIAN_PUPPET := $(PUPPET_BIN_DIR)/librarian-puppet

# Environment
export PATH := /usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
unexport GEM_HOME
unexport GEM_PATH

.PHONY: all
all: librarian-puppet puppet

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

.PHONY: librarian-puppet
librarian-puppet: ext_modules

#===============================================================================

ext_modules: Puppetfile Puppetfile.lock | $(LIBRARIAN_PUPPET)
	PATH=$(PUPPET_BIN_DIR):$$PATH $(LIBRARIAN_PUPPET) install --path=$@ --verbose

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

$(LIBRARIAN_PUPPET): | $(GEM)
	sudo $(GEM) install --quiet --no-document librarian-puppet
