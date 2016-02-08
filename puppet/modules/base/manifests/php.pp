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
      # amqp
      apcu     => {
        ensure   => 'latest',
        provider => 'apt',
      },
      # Bitset
      curl     => {
        ensure   => 'latest',
        provider => 'apt',
      },
      # event
      # expect
      # gd
      # gettext
      # http
      # imagick
      intl     => {
        ensure   => 'latest',
        provider => 'apt',
      },
      json     => {
        ensure   => 'latest',
        provider => 'apt',
      },
      # jsonc
      # libsodium
      # mailparse
      # maxminddb
      # memcache
      mysql    => {
        ensure   => 'latest',
        provider => 'apt',
      },
      # phar
      proctitle => {
        ensure   => 'latest',
        provider => 'pecl',
        source   => 'channel://pecl.php.net/proctitle-0.1.2',
      },
      # pthreads
      readline => {
        ensure   => 'latest',
        provider => 'apt',
      },
      # redis
      sqlite   => {
        ensure   => 'latest',
        provider => 'apt',
      },
      # runkit
      # tidy
      # twig
      # varnish
      # v8js
      #weakref  => {
      #  ensure   => '0.2.6',
      #  provider => 'pecl',
      #},
      xdebug   => {
        ensure   => 'latest',
        provider => 'apt',
      },
      xhprof   => {
        ensure   => 'latest',
        provider => 'pecl',
        source   => 'channel://pecl.php.net/xhprof-0.9.4',
      },
      # yaml
    },
  }

}
