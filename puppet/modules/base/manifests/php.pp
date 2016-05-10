# Install and configure PHP.
#
class base::php {

  # TODO: See https://github.com/mayflower/puppet-php/issues/156.
  class { 'php':
    extensions   => {
      curl      => {
        ensure   => 'latest',
        provider => 'apt',
      },
      intl      => {
        ensure   => 'latest',
        provider => 'apt',
      },
      imagick    => {
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
      #sqlite    => {
      #        ensure   => 'latest',
      #       provider => 'apt',
      #     },
      'Weakref' => {
        ensure   => 'latest',
        provider => 'pecl',
        source   => 'channel://pecl.php.net/Weakref-0.3.2',
        so_name  => 'weakref',
      },
      xdebug    => {
        ensure   => 'latest',
        provider => 'pecl',
      },
      #xhprof    => {
      #  ensure   => 'latest',
      #       provider => 'pecl',
      #       source   => 'channel://pecl.php.net/xhprof-0.9.4',
      #     },
      yaml      => {
        ensure   => 'latest',
        provider => 'pecl',
      },
    },
  }

}
