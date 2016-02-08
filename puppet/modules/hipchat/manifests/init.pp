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
    location => "http://downloads.hipchat.com/${kernel}/apt",
    release  => 'stable',
    repos    => 'main',
    include  => {
      deb => true,
      src => false,
    },
    key      => {
      id     => '69F57C04EA38EEE7A47E9BCCAAD4AA21729B5780',
      source => 'https://www.hipchat.com/keys/hipchat-linux.key',
    },
  }

  package { 'hipchat':
    ensure  => $ensure,
    require => Apt::Source['hipchat'],
  }

}
