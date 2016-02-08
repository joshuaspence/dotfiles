class base::ruby {

  # TODO: `Package['rubygems']` is evaluated every time puppet runs.
  # See https://tickets.puppetlabs.com/browse/MODULES-3064.
  class { 'ruby':
    latest_release  => true,
    gems_version    => 'latest',
    rubygems_update => true,
  }

  class { 'ruby::dev':
    ensure           => 'latest',
    rake_ensure      => 'latest',
    rake_provider    => 'gem',
    bundler_ensure   => 'latest',
    bundler_provider => 'gem',
  }

}
