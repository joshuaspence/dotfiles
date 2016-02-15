# Environment
DIST  := $(shell lsb_release --codename --short)
USER  := $(shell whoami)

# Core Commands
APT    = /usr/bin/apt-get
DPKG   = /usr/bin/dpkg
RM     = /bin/rm
SUDO   = /usr/bin/sudo
WGET   = /usr/bin/wget

# Commands
PUPPET_BIN_DIR = /opt/puppetlabs/puppet/bin
FACTER = $(PUPPET_BIN_DIR)/facter
GEM    = $(PUPPET_BIN_DIR)/gem
HIERA  = $(PUPPET_BIN_DIR)/hiera
PUPPET = $(PUPPET_BIN_DIR)/puppet
R10K   = $(PUPPET_BIN_DIR)/r10k

unexport GEM_HOME
export PATH := $(PUPPET_BIN_DIR):/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

.PHONY: all
all: r10k puppet

.PHONY: clean
clean:
	$(RM) --force --recursive ext_modules/
	$(RM) --force puppet.deb

.PHONY: puppet
puppet: ext_modules | $(PUPPET)
	$(SUDO) \
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

#=====================

$(PUPPET_BIN_DIR)/%: | puppet.deb
	$(SUDO) $(DPKG) --install $|
	$(SUDO) $(APT) update
	$(SUDO) $(APT) install puppet-agent

$(R10K): | $(GEM)
	sudo $(GEM) install --force r10k

ext_modules: Puppetfile | $(R10K)
	$(R10K) puppetfile install --verbose
	$(R10K) puppetfile purge

puppet.deb: | $(WGET)
	$(WGET) --output-document=$@ https://apt.puppetlabs.com/puppetlabs-release-pc1-$(DIST).deb

$(WGET):
	$(SUDO) $(APT) install wget
