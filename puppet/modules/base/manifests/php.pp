# Install and configure PHP.
#
class base::php {

  # TODO: See https://github.com/mayflower/puppet-php/issues/156.
  class { 'php':
    ensure       => 'latest',
    manage_repos => true,
    fpm          => false,
    dev          => true,
    composer     => true,
    pear         => true,
    pear_ensure  => 'latest',
    phpunit      => true,
    extensions   => {
      apcu      => {
        ensure   => 'latest',
        provider => 'apt',
      },
      curl      => {
        ensure   => 'latest',
        provider => 'apt',
      },
      intl      => {
        ensure   => 'latest',
        provider => 'apt',
      },
      json      => {
        ensure   => 'latest',
        provider => 'apt',
      },
      mysql     => {
        ensure   => 'latest',
        provider => 'apt',
      },
      proctitle  => {
        ensure   => 'latest',
        provider => 'pecl',
        source   => 'channel://pecl.php.net/proctitle-0.1.2',
      },
      readline  => {
        ensure   => 'latest',
        provider => 'apt',
      },
      sqlite    => {
        ensure   => 'latest',
        provider => 'apt',
      },
      'Weakref' => {
        ensure   => '0.2.6',
        provider => 'pecl',
        so_name  => 'weakref',
      },
      xdebug    => {
        ensure   => 'latest',
        provider => 'apt',
      },
      xhprof    => {
        ensure   => 'latest',
        provider => 'pecl',
        source   => 'channel://pecl.php.net/xhprof-0.9.4',
      },
    },
  }

}
