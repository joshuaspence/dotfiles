# Install and configure Dropbox.
#
class dropbox(
  $ensure = 'present',
) {

  validate_re($ensure, '^(absent|present|latest)$')

  $operatingsystem = downcase($::operatingsystem)

  apt::source { 'dropbox':
    ensure   => $ensure ? {
      absent  => 'absent',
      present => 'present',
      latest  => 'present',
    },
    location => "http://linux.dropbox.com/${operatingsystem}",
    repos    => 'main',
    include  => {
      deb => true,
      src => false,
    },
    key      => {
      id     => '1C61A2656FB57B7E4DE0F4C1FC918B335044912E',
      server => 'pgp.mit.edu',
    },
  }

  package { 'dropbox':
    ensure  => $ensure,
    require => Apt::Source['dropbox'],
  }

}
