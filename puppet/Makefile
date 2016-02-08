DIST  := $(shell lsb_release --codename --short)
EMPTY :=
SPACE := $(EMPTY) $(EMPTY)
USER  := $(shell whoami)

APT    = /usr/bin/apt-get
DPKG   = /usr/bin/dpkg
RM     = /bin/rm
SUDO   = /usr/bin/sudo
WGET   = /usr/bin/wget

PUPPET_BIN_DIR = /opt/puppetlabs/puppet/bin
FACTER = $(PUPPET_BIN_DIR)/facter
HIERA  = $(PUPPET_BIN_DIR)/hiera
PUPPET = $(PUPPET_BIN_DIR)/puppet
R10K   = $(PUPPET_BIN_DIR)/r10k

export PATH := $(PUPPET_BIN_DIR):/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

.PHONY: all
all: r10k puppet

.PHONY: puppet
puppet: ext_modules | $(PUPPET)
	$(SUDO) FACTER_id=$(USER) $(PUPPET) apply \
		--basemodulepath=./modules:./ext_modules \
		--hiera_config=./hiera.yaml \
		--strict_variables \
		manifests/site.pp

.PHONY: install
install: $(PUPPET)

.PHONY: r10k
r10k: ext_modules

#=====================

$(PUPPET_BIN_DIR)/*: | puppet.deb
	$(SUDO) $(DPKG) --install $^
	$(SUDO) $(APT) update
	$(SUDO) $(APT) install puppet-agent

ext_modules: Puppetfile | $(R10K)
	$(R10K) puppetfile install --verbose
	$(R10K) puppetfile purge

puppet.deb:
	$(WGET) --output-document=$@ https://apt.puppetlabs.com/puppetlabs-release-pc1-$(DIST).deb
