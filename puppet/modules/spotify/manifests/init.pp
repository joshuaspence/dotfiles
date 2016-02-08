# Install and configure Spotify.
#
class spotify(
  $ensure = 'present',
) {

  validate_re($ensure, '^(absent|present|latest)$')

  apt::source { 'spotify':
    ensure   => $ensure ? {
      absent  => 'absent',
      present => 'present',
      latest  => 'present',
    },
    location => 'http://repository.spotify.com',
    release  => 'stable',
    repos    => 'non-free',
    include  => {
      deb => true,
      src => false,
    },
    key      => {
      id     => 'BBEBDCB318AD50EC6865090613B00F1FD2C19886',
      server => 'keyserver.ubuntu.com',
    },
  }

  package { 'spotify-client':
    ensure  => $ensure,
    require => Apt::Source['spotify'],
  }

}
