# Install and configure puppet.
#
class puppet(
  $ensure = 'present',
) {

  validate_re($ensure, '^(absent|present|latest)$')

  apt::source { 'puppetlabs-pc1':
    ensure   => $ensure ? {
      absent  => 'absent',
      present => 'present',
      latest  => 'present',
    },
    location => 'https://apt.puppetlabs.com',
    repos    => 'PC1',
    key      => {
      id     => '47B320EB4C7C375AA9DAE1A01054B7A24BD6EC30',
      server => 'pgp.mit.edu',
    },
  }

  package { 'puppet-agent':
    ensure  => $ensure,
    require => Apt::Source['puppetlabs-pc1'],
  }

}
