# Install and configure PHP.
#
class base::php {

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
      apcu     => {
        ensure   => 'latest',
        provider => 'apt',
      },
      curl     => {
        ensure   => 'latest',
        provider => 'apt',
      },
      intl     => {
        ensure   => 'latest',
        provider => 'apt',
      },
      json     => {
        ensure   => 'latest',
        provider => 'apt',
      },
      mysql    => {
        ensure   => 'latest',
        provider => 'apt',
      },
      proctitle => {
        ensure   => 'latest',
        provider => 'pecl',
        source   => 'channel://pecl.php.net/proctitle-0.1.2',
      },
      readline => {
        ensure   => 'latest',
        provider => 'apt',
      },
      sqlite   => {
        ensure   => 'latest',
        provider => 'apt',
      },
      weakref  => {
        ensure   => '0.2.6',
        provider => 'pecl',
      },
      xdebug   => {
        ensure   => 'latest',
        provider => 'pecl',
        zend     => true,
      },
      xhprof   => {
        ensure   => 'latest',
        provider => 'pecl',
        source   => 'channel://pecl.php.net/xhprof-0.9.4',
      },
    },
  }

}
