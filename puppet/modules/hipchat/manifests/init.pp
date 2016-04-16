class hipchat(
  $ensure = 'present',
) {

  validate_re($ensure, '^(absent|present|latest)$')

  $kernel = downcase($::kernel)

  apt::source { 'hipchat':
    ensure   => $ensure ? {
      absent  => 'absent',
      present => 'present',
      latest  => 'present',
    },
    location => "https://atlassian.artifactoryonline.com/atlassian/hipchat-apt-client",
    repos    => 'main',
    include  => {
      deb => true,
      src => false,
    },
    key      => {
      id     => 'FD1ACC751D0106938C1E6B33EBA59E53CC64091D',
      source => 'https://atlassian.artifactoryonline.com/atlassian/api/gpg/key/public',
    },
  }

  package { 'hipchat':
    ensure  => $ensure,
    require => Apt::Source['hipchat'],
  }

}
