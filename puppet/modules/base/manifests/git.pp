# Install and configure git.
#
class base::git {

  apt::ppa { 'ppa:git-core/ppa':
    before => Package['git'],
  }

  class { 'git':
    package_ensure => 'latest',
  }

}
