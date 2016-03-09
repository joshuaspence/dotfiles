# Install and configure Google Chrome.
#
class google_chrome(
  $ensure = 'present',
) {

  validate_re($ensure, '^(absent|present|latest)$')

  apt::source { 'google-chrome':
    ensure       => $ensure ? {
      absent  => 'absent',
      present => 'present',
      latest  => 'present',
    },
    location     => 'http://dl.google.com/linux/chrome/deb/',
    release      => 'stable',
    repos        => 'main',
    include      => {
      deb => true,
      src => false,
    },
    key          => {
      id     => '4CCA1EAF950CEE4AB83976DCA040830F7FAC5991',
      source => 'https://dl.google.com/linux/linux_signing_key.pub',
    },
    architecture => 'amd64',
  }

  package { 'google-chrome-stable':
    ensure  => $ensure,
    require => Apt::Source['google-chrome'],
  }

}
