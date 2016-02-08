class base {

  include base::apt
  include base::git
  include base::java
  include base::packages # TODO
  include base::php # TODO
  include base::ruby
  include base::tmp
  include lm_sensors

  class { 'arcanist': }

  class { 'dotfiles':
    ensure => 'latest',
  }

  class { 'dropbox':
    ensure => 'latest',
  }

  class { 'google_chrome':
    ensure => 'latest',
  }

  class { 'hipchat':
    ensure => 'latest',
  }

  class { 'mysql::client':
    package_ensure => 'latest',
  }

  # TODO: See https://github.com/voxpupuli/puppet-nodejs/issues/165.
  class { 'nodejs':
    nodejs_package_ensure => 'latest',
    repo_url_suffix       => '5.x',
  }

  class { 'ntp':
    package_ensure => 'latest',
  }

  class { 'puppet':
    ensure => 'latest',
  }

  class { 'python':
    ensure     => 'latest',
    version    => 'system',
    pip        => 'latest',
    dev        => 'latest',
    virtualenv => 'latest',
    provider   => 'pip',
  }

  class { 'spotify':
    ensure => 'latest',
  }

  class { 'sublime_text':
    ensure => 'latest',
  }

  class { 'ssh':
    server_options      => {
      PasswordAuthentication => 'no',
      PermitEmptyPasswords   => 'no',
      PermitRootLogin        => 'no',
      PubkeyAuthentication   => 'yes',
    },
    client_options       => {},
    version              => 'latest',
    storeconfigs_enabled => false,
  }

  class { 'sudo':
    package_ensure      => 'latest',
    purge               => true,
    config_file_replace => true,
  }

  class { 'timezone':
    timezone    => 'Australia/Sydney',
    autoupgrade => true,
  }

  class { 'vagrant':
    ensure => 'latest',
  }

  class { 'virtualbox':
    package_ensure => 'latest',
  }

  class { 'wget':
    version => 'latest',
  }

}
